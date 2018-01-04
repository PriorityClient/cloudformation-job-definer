import { Map, fromJS } from 'immutable';
import fs from 'fs';

const DEFAULT_CFN = fromJS({
  Description: "",
  Conditions: {},
  Parameters: {},
  Resources: {},
  Outputs: {},
})

export default function generate_cloudformation(document=DEFAULT_CFN){
	const resources = generate_lambdas_for(document.get('Resources'), ...document.get('Jobs'));
  const outputs   = generate_outputs_for(document.get('Outputs'), ...document.get('Jobs'));
	return document
					.set("Resources", resources)
					.set("Outputs", outputs)
					.delete("Jobs");
}

export function generate_lambda_function_for(job){
  const route = JSON.stringify(job.get('route'));
	const values = {
		payload: {
			token: job.get('token'),
			job_name: job.get('name')
		}
	};
	return fs.readFileSync(`${__dirname}/lambda-guts.js`, 'utf8')
}

function generate_outputs_for(outputs=Map(), job, ...remaining){
  return outputs
  /*
	if(!job) return outputs
	const updated_outputs = outputs.merge(output_for(job));
	return generate_outputs_for(updated_outputs, ...remaining);
  */
}

function generate_lambdas_for(resources=Map(), job, ...remaining){
	if(!job) return resources
	const updated_resources = resources
															.merge(lambda_for(job))
															.merge(trigger_for(job))
															.merge(permission_for(job));
	return generate_lambdas_for(updated_resources, ...remaining);
}

const name_lambda  = (job) => `${job.get('name')}CronRunner`;
const name_trigger = (job) => `${job.get('name')}CronTrigger`;
const name_permission = (job) => `${job.get('name')}TriggerPermission`;
const describe_lambda = (job) => `Lambda cron runner for ${job.get('name')}`;

const lambda_for = (job) => {
	const name = job.get('name');

	const contents = generate_lambda_function_for(job);
	const properties = fromJS({
		"Code" : {
			"ZipFile" : contents
		},
		"Description"  : describe_lambda(job),
		"Handler"      : "index.handler",
		"Role"         : { "Fn::GetAtt" : ["JobRunnerRole", "Arn"] },
		"Runtime"      : "nodejs4.3",
		"Timeout"      : 30,
		"Environment"  : { "Variables" : {
													"BUCKET" : job.get('tokenBucketName'),
													"KEY" : job.get('tokenLocation'),
													"HOSTNAME" : job.get("ApiHost"),
													"REQUEST_PATH" : job.get('path'),
													"JOB_NAME" : job.get('name')
												}
										 }
	}).merge(job.get('Properties'));

	return Map([[ name, Map({
				"Type" : "AWS::Lambda::Function",
				"Properties": properties
			}).setIn(["Condition"], job.get("Condition"))]]);
}

const trigger_for = (job) => {
	const name = job.get('name');
	const cron = job.get('cron');

	const properties = fromJS(
		{
			"Description" : `cron trigger for ${name_trigger(job)}`,
			"ScheduleExpression" : `cron(${job.get('cron')})`,
			"Targets" : [
				{
					"Arn" : { "Fn::GetAtt" : [ name, "Arn" ] },
					"Id" : name_lambda(job)
				}
			]
		}
	);

	return Map([[ name_trigger(job), Map({
				"Type" : "AWS::Events::Rule",
				"Properties": properties
			}).setIn(["Condition"], job.get("Condition"))
		]]);
}

const permission_for = (job) => {
  const properties = fromJS({
    "Action": "lambda:InvokeFunction",
    "FunctionName" : { "Ref" : job.get('name') },
    "Principal"    : "events.amazonaws.com",
    "SourceArn"    : { "Fn::GetAtt" : [ name_trigger(job) , "Arn" ]}
  });
	return Map([[ name_permission(job), Map({
        "Type" : "AWS::Lambda::Permission",
				"Properties": properties
			}).setIn(["Condition"], job.get("Condition"))
		]]);
}

const output_for = (job) => {
	const name = job.get('name');
	return Map([[
		`${name}`, {
      "Description" : `Lambda reference for ${name}`,
      "Value" : { "Ref" : `${name}` }
    }
	]])
}

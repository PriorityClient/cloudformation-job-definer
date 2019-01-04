'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = generate_cloudformation;
exports.generate_lambda_function_for = generate_lambda_function_for;

var _immutable = require('immutable');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var DEFAULT_CFN = (0, _immutable.fromJS)({
	Description: "",
	Conditions: {},
	Parameters: {},
	Resources: {},
	Outputs: {}
});

function generate_cloudformation() {
	var document = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_CFN;

	var resources = generate_lambdas_for.apply(undefined, [document.get('Resources')].concat(_toConsumableArray(document.get('Jobs'))));
	var outputs = generate_outputs_for.apply(undefined, [document.get('Outputs')].concat(_toConsumableArray(document.get('Jobs'))));
	return document.set("Resources", resources).set("Outputs", outputs).delete("Jobs");
}

function generate_lambda_function_for(job) {
	var route = JSON.stringify(job.get('route'));
	var values = {
		payload: {
			token: job.get('token'),
			job_name: job.get('name')
		}
	};
	return _fs2.default.readFileSync(__dirname + '/lambda-guts.js', 'utf8');
}

function generate_outputs_for() {
	var outputs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : (0, _immutable.Map)();
	var job = arguments[1];

	return outputs;
	/*
 if(!job) return outputs
 const updated_outputs = outputs.merge(output_for(job));
 return generate_outputs_for(updated_outputs, ...remaining);
 */
}

function generate_lambdas_for() {
	var resources = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : (0, _immutable.Map)();
	var job = arguments[1];

	if (!job) return resources;
	var updated_resources = resources.merge(lambda_for(job)).merge(trigger_for(job)).merge(permission_for(job));

	for (var _len = arguments.length, remaining = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
		remaining[_key - 2] = arguments[_key];
	}

	return generate_lambdas_for.apply(undefined, [updated_resources].concat(remaining));
}

var name_lambda = function name_lambda(job) {
	return job.get('name') + 'CronRunner';
};
var name_trigger = function name_trigger(job) {
	return job.get('name') + 'CronTrigger';
};
var name_permission = function name_permission(job) {
	return job.get('name') + 'TriggerPermission';
};
var describe_lambda = function describe_lambda(job) {
	return 'Lambda cron runner for ' + job.get('name');
};

var lambda_for = function lambda_for(job) {
	var name = job.get('name');

	var contents = generate_lambda_function_for(job);
	var properties = (0, _immutable.fromJS)({
		"Code": {
			"ZipFile": contents
		},
		"Description": describe_lambda(job),
		"Handler": "index.handler",
		"Role": { "Fn::GetAtt": ["JobRunnerRole", "Arn"] },
		"Runtime": "nodejs8.10",
		"Timeout": 30,
		"Environment": { "Variables": {
				"BUCKET": job.get('tokenBucketName'),
				"KEY": job.get('tokenLocation'),
				"HOSTNAME": job.get("ApiHost"),
				"REQUEST_PATH": job.get('path'),
				"JOB_NAME": job.get('name')
			}
		}
	}).merge(job.get('Properties'));

	return (0, _immutable.Map)([[name, (0, _immutable.Map)({
		"Type": "AWS::Lambda::Function",
		"Properties": properties
	}).setIn(["Condition"], job.get("Condition"))]]);
};

var trigger_for = function trigger_for(job) {
	var name = job.get('name');
	var cron = job.get('cron');

	var properties = (0, _immutable.fromJS)({
		"Description": 'cron trigger for ' + name_trigger(job),
		"ScheduleExpression": 'cron(' + job.get('cron') + ')',
		"Targets": [{
			"Arn": { "Fn::GetAtt": [name, "Arn"] },
			"Id": name_lambda(job)
		}]
	});

	return (0, _immutable.Map)([[name_trigger(job), (0, _immutable.Map)({
		"Type": "AWS::Events::Rule",
		"Properties": properties
	}).setIn(["Condition"], job.get("Condition"))]]);
};

var permission_for = function permission_for(job) {
	var properties = (0, _immutable.fromJS)({
		"Action": "lambda:InvokeFunction",
		"FunctionName": { "Ref": job.get('name') },
		"Principal": "events.amazonaws.com",
		"SourceArn": { "Fn::GetAtt": [name_trigger(job), "Arn"] }
	});
	return (0, _immutable.Map)([[name_permission(job), (0, _immutable.Map)({
		"Type": "AWS::Lambda::Permission",
		"Properties": properties
	}).setIn(["Condition"], job.get("Condition"))]]);
};

var output_for = function output_for(job) {
	var name = job.get('name');
	return (0, _immutable.Map)([['' + name, {
		"Description": 'Lambda reference for ' + name,
		"Value": { "Ref": '' + name }
	}]]);
};

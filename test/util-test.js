"use strict";

var utils = require('../lib/utils'),
    assert = require('assert'),
    chance = require('chance').Chance(),
    sinon = require('sinon');

describe('soap utils', function() {

	describe('.sign()', function(){

		function signer(envelope, options, callback){
			callback(null, envelope);
		}

		it('should return if no signers', function(done){
			utils.sign([], "", {}, function(err, envelope){
				done(err);
			});
		});

		it('should return the envelope if no signers', function(done){
			var expected = chance.string();
			utils.sign([], expected, {}, function(err, envelope){
				assert.equal(envelope,expected);
				done(err);
			});
		});

		it('should modify the envelope if signer returns different', function(done){
			var original = chance.string();
			var expected = chance.string();
			var stubbedSigner = sinon.stub();
			utils.sign([stubbedSigner], original, {}, function(err, envelope){
				assert.equal(envelope,expected);
				done(err);
			});
			// utils.sign should be "sync" unless one of the signers uses async (tests are sync)
			stubbedSigner.args[0][2](null, expected);
		});

		it('should pass the options to the signer', function(done){
			var key = chance.string();
			var value = chance.string();
			var options = {};
			options[key] = value;
			var spiedSigner = sinon.spy(signer);
			utils.sign([spiedSigner], "", options, function(err){
				assert.equal(spiedSigner.args[0][1][key], value);
				done(err);
			});
		});

		it('should call all signers', function(done){
			var signers = [
				sinon.spy(signer),
				sinon.spy(signer),
				sinon.spy(signer)
			];
			utils.sign(signers, "", {}, function(err){
				assert(signers[0].calledOnce);
				assert(signers[1].calledOnce);
				assert(signers[2].calledOnce);
				done(err);
			});
		});

		it('should return an error if signer returned one', function(done){
			var expected = chance.string();
			var stubbedSigner = sinon.stub();
			utils.sign([stubbedSigner], "", {}, function(err){
				assert.equal(err.message, expected);
				done();
			});
			stubbedSigner.args[0][2](new Error(expected));
		});

		it('should immediately return an error if signer returned one', function(done){
			var expected = chance.string();
			var stubbedSigner = sinon.stub();
			var signers = [
				stubbedSigner,
				sinon.spy(signer),
				sinon.spy(signer)
			];
			utils.sign(signers, "", {}, function(){
				assert(signers[0].calledOnce);
				assert(!signers[1].called);
				assert(!signers[2].called);
				done();
			});
			stubbedSigner.args[0][2](new Error(expected));
		});

		it('should return an error if signer threw one', function(done){
			var expected = chance.string();
			var stubbedSigner = sinon.stub().throws(new Error(expected));
			utils.sign([stubbedSigner], "", {}, function(err){
				assert.equal(err.message, expected);
				done();
			});
		});

		it('should immediately return an error if signer threw one', function(done){
			var expected = chance.string();
			var stubbedSigner = sinon.stub().throws(new Error(expected));
			var signers = [
				stubbedSigner,
				sinon.spy(signer),
				sinon.spy(signer)
			];
			utils.sign(signers, "", {}, function(){
				assert(signers[0].calledOnce);
				assert(!signers[1].called);
				assert(!signers[2].called);
				done();
			});
		});
	});
});
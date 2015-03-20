#Contribution Guidelines

Thank you for your support!  node-soap wouldn't be where it is today without contributors like you who are willing to take the time to improve it for everyone else.

Because SOAP Web Services can differ amongst implementations, there is high risk involved in making changes.  What works for your WSDL, might not work with another.  It is therefore _essential_ that contributors to node-soap adhere to these guidelines.

##Filing issues
* Please look through the issues that are currently open in the attempt to find one that matches yours.
* If you find an issue that matches yours, please submit your documentation about it there as it will help everyone understand it more.
* If you plan on fixing the issue, please take the time to fix it first and then provide a Pull Request.
* Please be descriptive in your issue titles  I.E. "Error occurs when calling client.foo on WSDL without import element."

##Submitting a Pull Request
* Pull Requests **must be rebased to the latest version of master and _squashed to a single commit_** i.e. `git checkout master;git pull upstream master;git checkout feature-branch;git rebase -i master`
* Pull Requests **must have accompanying tests** (either Unit or Request/Response Sample tests are welcome). Your chances of getting the PR merged are very low if you don't provide any tests.
* Pull Requests must have passing travis builds.
* Pull Requests must be able to merge automatically from github.
* Please **do not close a pull request due to a request to rebase**.  Git is a powerful VCS and deserves your time in learning how to rebase properly.  Pull Requests are updated automatically on github when you force push to your branch after rebasing. 

Very useful articles/help on this topic: 
  - [GitHub Help - About Git rebase](https://help.github.com/articles/about-git-rebase/) 
  - [GitHub Help - Using Git rebase](https://help.github.com/articles/using-git-rebase/)

* Please use descriptive commit messages.  Commit messages are used during the creation of history and release notes.  You'll make the job of maintaners much easier by doing this.

##Making Changes
* Any and all pull requests to change documentation or typos are welcome!
* Any WSDL checked in should be as small and as generic as possible.  This is to keep the size of the codebase from growing too large and to keep the reason for submitting the WSDL clear I.E. if the WSDL was submitted because attributes were not being parsed on response XML, then it would be appropriate to submit a WSDL that defines a response with attributes *and nothing else*.  If you find an issue with the parser not being able to handle large WSDLs, then it would be approprate to sumbit a large WSDL to recreate the issue with.
* If your issue is WSDL related:
````
    1. Make your WSDL as generic as possible to recreate the issue
    2. Add the WSDL to the appropriate path in test/wsdl.
    3. Commit your changes to a feature branch within your fork.
    4. Issue a pull request.
````

* If your issue is client related:
````
    1. Capture the request / response XMl via client.lastRequest and client.lastResponse as well as the WSDL.
    2. Make the WSDL, request, and response XML as generic as possible.
    3. Only include the messages or operations that are having issues.
    4. Add the appropriate files to test/request-response-samples (see the README therein)
    5. Commit your changes to a feature branch within your fork.
    6. Issue a pull request
````

* If your issue is neither WSDL nor client related:
````
    1. Provide a test of some form in an appropriate *-test.js file under test/
    2. Commit your changes to a feature branch within your fork.
    3. Issue a pull request.
````

##Issue Expiration
Any pull request or issue filed is subject to an expiration date.  We will close any open issue that has not recieved a response within a 2 week timeframe.  The goal is not to sweep dirt under the rug, but to keep the focus on merging in pull requests.  Please provide pull requests that meet the above criteria wherever possible.

##Other ways you can contribute
Please add response, request, and WSDL files to test/wsdl, and test/request-response-samples (see README therein).  Doing so documents behavior and reduces the likelihood that bugs will be introduced by future pull requests.

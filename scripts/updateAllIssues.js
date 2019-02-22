const githubToken = ""; //https://github.com/settings/tokens
const test = true;

const toGet = "checkError";
const toSet = "checkError2";

const issueTitle = "Think about to fix the issues found by adapter checker";

const adapterTestLink = "https://3jjxddo33l.execute-api.eu-west-1.amazonaws.com/default/checkAdapter?url=";

let adapterList;

const start = async function(){
		adapterList = await getAdapterList();
   if(adapterList){
   	if(!adapterList[toSet]){
      	adapterList[toSet] = {};
      }
      $('#listeSuccess').append("<li style='color: blue;'>" + toGet + ": " + Object.keys(adapterList[toGet]).length + "/<span id='" + toGet + "'></span></li>");
      $('#listeSuccess').append("<li style='color: blue;'>" + toSet + ": " + Object.keys(adapterList[toSet]).length + "/<span id='" + toSet + "'></span></li>");
      $('#listeSuccess').append("<li style='color: blue;'>checkOk: " + adapterList.checkOk.length + "/<span id='checkOk'></span></li>");
      await startFunc();
      await delay(10000);
      console.log(JSON.stringify(adapterList));
      $('#checkOk').text(adapterList.checkOk.length);
      $('#' + toSet).text(Object.keys(adapterList[toSet]).length);
      $('#' + toGet).text(Object.keys(adapterList[toGet]).length);
      $('#result').text(JSON.stringify(adapterList));
   }else{
   	$('#liste').append("<li style='color: red;'>ERROR " + Object.keys(adapterList[toGet]).length + " " + Object.keys(adapterList[toSet]).length + "</li>");    
   }
} 

const delay = ms => new Promise(res => setTimeout(res, ms));

const startFunc = async function(){
   
   if(adapterList){
			
     for(const full_name in adapterList[toGet]){
       const testLink = "https://raw.githubusercontent.com/" + full_name;
       const testResult = await doTheTest(testLink);
       
       const issueNr = adapterList[toGet][full_name].issue;
       const issuesList = adapterList[toGet][full_name].errorList;

       if(testResult && testResult.errors && testResult.errors.length > 0){
       	try{
             let issueBody = "I am an automatic service that looks for possible errors in ioBroker and creates an issue for it. The link below leads directly to the test:\r\n\r\n";
             issueBody += "https://adapter-check.iobroker.in/?q=" + testLink + "\r\n\r\n";
             const errorList = [];
             const warningList = [];
             testResult.errors.forEach(function(issue) {
               issueBody += "- [ ] " + issue + "\r\n";           
                errorList.push(issue.substring(1, 5));           
             });
             if(testResult.warnings && testResult.warnings.length > 0){
                issueBody += "\r\nI have also found warnings that may be fixed if possible.\r\n\r\n";
                testResult.warnings.forEach(function(issue) {
                   issueBody += "- [ ] " + issue + "\r\n";
                   warningList.push(issue.substring(1, 5));
                });
             } 
             
             issueBody += "\r\nThanks,\r\nyour automatic adapter checker.";
             issueBody += addComminityText(full_name);
             
             const errorNotChanged = errorList.length === issuesList.length && errorList.sort().every(function(value, index) { return value === issuesList.sort()[index]});
             
             if (test) {            	
               testIssueCreation(full_name, testResult.errors.length, errorNotChanged, testResult.warnings);               
             } else if (githubToken && !errorNotChanged) {
               createIssue(full_name, issueBody, testResult.errors.length, issueNr, errorList, warningList);
             } else if (githubToken && errorNotChanged) {
                adapterList[toSet][full_name] = adapterList[toGet][full_name];
                delete adapterList[toGet][full_name];
             } else {
               testIssueCreation("NO TOKEN - " + full_name, testResult.errors.length);
             }
         }catch(e){
           console.error(full_name + " - " + e);
         }
       } else if (testResult && testResult.errors && testResult.errors.length === 0){
       	if(!test && githubToken){
        		closeIssue(full_name, issueNr);
         }
         $('#liste').append("<li style='color: green;'>" + full_name + " fixed - checked but no error found</li>");
       }
     }

   }
}

$("button").on("click", function(){
  start();
});

function addComminityText(full_name){
	if(!full_name.startsWith("ioBroker/") && !full_name.startsWith("iobroker-community-adapters/")){
  	return "\r\n\r\nP.S.: There is a community in Github, which supports the maintenance and further development of adapters. There you will find many experienced developers who are always ready to assist anyone. New developers are always welcome there. For more informations visit: https://github.com/iobroker-community-adapters/info";
  }else{
  	return "";
  }
}

function GithubInteractor(token) {
    this.token = token;
}

const interactor = new GithubInteractor(githubToken);
 
function createIssue(repo, issueBody, count, issueNr, errorList, warningList) {

    var url = "https://api.github.com/repos/" + repo + "/issues/" + issueNr;
    $.ajax({
        	url: url,
        	type: "PATCH",
        	beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "token " + interactor.token);
        	},
        	error: function(xhr, status, error) {
        		var err = JSON.parse(xhr.responseText);
        		$('#liste').append("<li style='color: red;'>" + repo + " - issue failed (" + status + ": " + error + ")</li>");
 			},        
    		success: function (issue) { 
        		adapterList[toSet][repo] = {};
         	adapterList[toSet][repo].errorList = errorList;
            adapterList[toSet][repo].warningList = warningList;
            adapterList[toSet][repo].issue = issue.number;         
            adapterList[toSet][repo].errorCount = count;
            adapterList[toSet][repo].status = issue.state;
            delete adapterList[toGet][repo];
            $('#listeSuccess').append("<li>\"" + repo + " (" + count + " errors) - issue updated</li>");
     		},
        	data: JSON.stringify({
            body: issueBody
        	})
    });
}

function closeIssue(repo, issueNr) {

    var url = "https://api.github.com/repos/" + repo + "/issues/" + issueNr + "/comments";
    const issueBody = "Thanks, that all bugs have been fixed.";
    $.ajax({
        	url: url,
        	type: "POST",
        	beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "token " + interactor.token);
        	},
        	error: function(xhr, status, error) {
        		var err = JSON.parse(xhr.responseText);
        		$('#liste').append("<li style='color: red;'>" + repo + " - issue failed (" + status + ": " + error + ")</li>");
 			},        
    		success: function (issue) {
        		adapterList.checkOk.push(repo);            
            delete adapterList[toGet][repo];
    		},
        	data: JSON.stringify({
            body: issueBody
        	})
    });
}

async function getAdapterList(){
	const link = "https://raw.githubusercontent.com/ioBrokerChecker/testData/master/data.json";
   try{  
      return await (await fetch(link, {cache: "no-cache"})).json();
   }catch(e){
      return null;
   }
}

async function checkIoPackage(ioPackageLink, adapter){
	try{  
		const ioPackage = await (await fetch(ioPackageLink)).json();
      const isAdapter = ioPackage && ioPackage.common;
      if(!isAdapter){
      	adapterList.noIoPackage.push(adapter);
      }     
   }catch(e){
   	adapterList.noIoPackage.push(adapter);     
   }
}

async function doTheTest(testLink){
   try{  
      return await (await fetch(adapterTestLink + testLink)).json();
   }catch(e){
      return {};
   }  	
}

function testIssueCreation(repo, count, notChanged, warnings) {
	let countW = 0;
   if(warnings){
   	countW = warnings.length;
   }
    $('#liste').append("<li style='color: " + (notChanged?"red":"blue") + "'>" + repo + " (" + count + " err & " + countW + " war) - issue " + (notChanged?"is the same":"has been changed (UPDATE)") + " </li>");
}
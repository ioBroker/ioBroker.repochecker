const githubToken = ""; //https://github.com/settings/tokens
const test = true;

let issueTitle = "Verify Compact mode for your adapter";

const issueBody = "We have detected that your adapter supports the compact mode. Please use the latest js-controller 2.0 and verify that everything works.\r\n\r\nSome more information what is important to check can be found at ioBroker/ioBroker.js-controller#512 \r\n\r\nOn questions please answer to the linked issue. Please close this issue after your test and add the version number that you have tested please as a comment.\r\n\r\nThank you for your support.";

let issuesCreated = [];

let issuesListFiltered = [];

const start = async function () {
    adapterList = await getAdapterList();
    if (adapterList) {         
    		$('#listeSuccess').append("<li style='color: blue;'>Done last time: <span id='alreadydone'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>Total Repos: <span id='totalrepos'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>Done now: <span id='donenow'></span></li>");        
        await startFunc();    
        await delay(15000);
        $('#donenow').text(issuesCreated.length);
        console.log(JSON.stringify(issuesCreated));
    } else {
        $('#liste').append("<li style='color: red;'>ERROR - NO ADAPTER LIST</li>");
    }
};

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array [index], index, array);
    }
}

(function ($) {
    $.extend({
        // Case insensative $.inArray (http://api.jquery.com/jquery.inarray/)
        // $.inArrayIn(value, array [, fromIndex])
        //  value (type: String)
        //    The value to search for
        //  array (type: Array)
        //    An array through which to search.
        //  fromIndex (type: Number)
        //    The index of the array at which to begin the search.
        //    The default is 0, which will search the whole array.
        inArrayIn: function (elem, arr, i) {
            // not looking for a string anyways, use default method
            if (typeof elem !== 'string') {
                return $.inArray.apply(this, arguments);
            }
            // confirm array is populated
            if (arr) {
                var len = arr.length;
                i = i ? (i < 0 ? Math.max(0, len + i) : i) : 0;
                elem = elem.toLowerCase();
                for (; i < len; i++) {
                    if (i in arr && arr[i].toLowerCase() == elem) {
                        return i;
                    }
                }
            }
            // stick with inArray/indexOf and return -1 on no match
            return -1;
        }
    });
})(jQuery);

const delay = ms => new Promise(res => setTimeout(res, ms));

const startFunc = async function () {
    
    let issuesList = [];

    adapterList.checkOk.forEach(function (full_name) {
      issuesList.push(full_name);
    });
    
    for (const full_name in adapterList.checkError) {
     issuesList.push(full_name);
  	}    
  	for (const full_name in adapterList.checkError2) {
     issuesList.push(full_name);
  	}
    for (const full_name in adapterList.checkErrorOld) {
     issuesList.push(full_name);
  	}
    
    if(adapterList.alreadydone){
      adapterList.alreadydone.forEach(function(full_name){
        issuesList = issuesList.filter(e => e !== full_name);
      });
      $('#alreadydone').text(adapterList.alreadydone.length);
    }
    
    await filterList(issuesList);        
  
}

$("button").on("click", function () {
    start();
});


function GithubInteractor(token) {
    this.token = token;
}

const interactor = new GithubInteractor(githubToken);

async function filterList(array) {

	await asyncForEach(array, async function(full_name){
     var link = "https://raw.githubusercontent.com/" + full_name + "/master/io-package.json";
     try {
           const ioPackage = await (await fetch(link)).json();
           const isCompact = ioPackage && ioPackage.common && ioPackage.common.compact;
           const isOnlyWWW = ioPackage && ioPackage.common && ioPackage.common.onlyWWW === true;
           if (isCompact && !isOnlyWWW) {
               issuesListFiltered.push(full_name);
           }
       } catch (e) {
         console.log(e);
       }
   });
   
  doTheIssues();

}

async function getAdapterList() {
    const link = "https://raw.githubusercontent.com/ioBrokerChecker/testData/master/data.json";
    try {
        return await (await fetch(link, {cache: "no-cache"})).json();
    } catch (e) {
        return null;
    }
}

function doTheIssues(){
	  $('#totalrepos').text(issuesListFiltered.length);
              
    issuesListFiltered.forEach(function (full_name) {  
    
    	  const adapter = full_name.split("/")[1];
        
        if(issueTitle === ""){
        	issueTitle = "Please check " + adapter + " with js-controller 2.0";
        }
    
        const url = "https://api.github.com/repos/" + full_name + "/issues";
        
        if(!test){
          $.ajax({
              url: url,
              type: "POST",
              beforeSend: function (xhr) {
                  xhr.setRequestHeader("Authorization", "token " + interactor.token);
              },
              error: function (xhr, status, error) {
                  var err = JSON.parse(xhr.responseText);
                  $('#liste').append("<li style='color: red;'>" + full_name + " - issue failed (" + status + ": " + error + ")</li>");
              },
              success: function (issue) {
                  issuesCreated.push(full_name);
                  $('#liste').append("<li>" + full_name + " - new issue created</li>");
              },
              data: JSON.stringify({
                  title: issueTitle,
                  body: issueBody
              })
          });
        }else{
        	issuesCreated.push(full_name);
        	$('#liste').append("<li>" + full_name + " - new TEST created</li>");
        }
   });
}

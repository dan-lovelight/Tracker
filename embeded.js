// Start loading sequence
const testServer = 'http://127.0.0.1:8887/'
const isDevUser = Knack.getUserRoles('object_44')

// Set default variables
const coreLibraries = [
    'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/sweetalert/2.1.2/sweetalert.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/bluebird/3.5.3/bluebird.min.js'
]

const prodLibraries = [
	'https://cdn.jsdelivr.net/gh/dan-lovelight/tracker/tracker.js',
  	//'https://cdn.jsdelivr.net/gh/dan-lovelight/tracker/callouts.js',
  	//'https://cdn.jsdelivr.net/gh/dan-lovelight/tracker/utilties.js'
]

const testLibraries = [
	'http://127.0.0.1:8887/tracker.js',
  	'http://127.0.0.1:8887/callouts.js',
  	'http://127.0.0.1:8887/utilties.js'
]

let activeLibraries = coreLibraries.concat(prodLibraries)

if (isDevUser) {
    let http = new XMLHttpRequest();
    http.open('HEAD', testServer, false);
    try {
    	http.send();
      	if (http.status!=404) {
        // Test server is available!
        activeLibraries = coreLibraries.concat(testLibraries)
        }
    } catch (err) {
    	console.log('test server not available')
    }
}

KnackInitAsync = function ($, callback) {
  window.$ = $;   //Explicitly include jQuery
  LazyLoad.js(activeLibraries, callback());
};

// End Loading sequence

window.myKnackHeaders = new Headers({
  'X-Knack-Application-Id': '58c1dff3a3871c282c3e879b',
  'X-Knack-REST-API-KEY': '096fa090-0900-11e7-8722-81c6d807aadc',
  'content-type': 'application/json'
});

window.myJobRecHeaders = new Headers({
  'API-token': '0553221da8772b4888b0fbd639e978a1',
  'Api-Secret-key': 'RdpmsXHo555R',
  'content-type': 'application/json'
});

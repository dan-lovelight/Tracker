// Limit the selectable time range to 6am to 8pm & show duration in to-time
// Takes a string for the target field id eg 'view_123-field_123'
function pimpTimePicker(fieldId) {
  // Set the time to 5am to 8pm
  $('#' + fieldId + '-time').timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': false
  });
  // Set the time to 5am to 8pm
  $('#' + fieldId + '-time-to').timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': true
  });
  // Update the start time of to-time for accurate duration when start time changes
  $('input#' + fieldId + '-time').on('focusout', function() {
    console.log('focusOut from time')
    $('#' + fieldId + '-time-to').timepicker('option', {
      minTime: $('#' + fieldId + '-time').val()
    })
  })
}

// Takes a Knack obect and an array of field pairs
// The first field pair is the source field, the second is the target field name
// If the array only has a single field, this is used for both source and target
// Returns a new object with the target fields copied from the source
function copyFieldsToNewObject(object, arrayOfFieldPairs) {
  let newObject = {}
  // As required by Knack, set the target field values to the raw data of the source field
  arrayOfFieldPairs.forEach((fieldPair) => {
    let sourceField = fieldPair[0]
    let targetField = fieldPair.length === 1 ? fieldPair[0] : fieldPair[1] // use target field name if provided, else source name

    // Copy the source field to the target field
    let copyFromField = object[sourceField + '_raw'] === undefined ? sourceField : sourceField + '_raw'
    newObject[targetField] = JSON.parse(JSON.stringify(object[copyFromField]))

    // Due to a Knack quirk, if the field is a date, the date field needs to be replaced with the formatted date
    if (isAnyDateFieldType(object[sourceField])) {
      delete Object.assign(newObject[targetField], {
        ['date']: newObject[targetField].date_formatted
      }).date_formatted;
      // If date field includes a 'to-date' this needs to be updated as well
      if (isToFromDateFieldType(object[sourceField])) {
        delete Object.assign(newObject[targetField].to, {
          ['date']: newObject[targetField].to.date_formatted
        }).date_formatted;
      }
    }
  })
  return newObject
}

function isAnyDateFieldType(fieldValue) {
  let dateRegex = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}.*/
  return fieldValue.match(dateRegex)
}

function isToFromDateFieldType(fieldValue) {
  let dateRegex = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}.*(to).*/
  return fieldValue.match(dateRegex)
}

function isObjectUpdated(object,arrayOfFieldPairs) {
  return arrayOfFieldPairs.some((fieldPair) => {
    return JSON.stringify(object[fieldPair[0]]) !== JSON.stringify(object[fieldPair[1]])
  })
}

// Compares two fields, a 'live' field and a 'previous' value field
// If live field is not blank, and the previous field is, assumed that just updated
// fieldPair is array: [liveField, previousField]
function isFieldJustAdded(object,fieldPairArray){
  return object[fieldPairArray[0]].length > 0 && object[fieldPairArray[1]].length === 0
}

// ---------------------- DATA MANAGEMENT ------------

// takes an object name (eg 'object_1') and a data object
// POSTs the data to create the record and returns the record
async function getRecordPromise(object, id) {
  const url = 'https://api.knackhq.com/v1/objects/' + object + '/records/' + id
  const init = {
    method: 'GET',
    headers: myKnackHeaders
  }
  try {
    let response = await fetch(url, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  } catch (err) {
    logError(getRecordPromise, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

// Updates record and returns the updated record
async function updateRecordPromise(object, id, data) {
  const url = 'https://api.knackhq.com/v1/objects/' + object + '/records/' + id
  const init = {
    method: 'PUT',
    headers: myKnackHeaders,
    body: JSON.stringify(data)
  }
  try {
    let response = await fetch(url, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  } catch (err) {
  logError(updateViewPromise, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

// Returns an array of records
async function searchRecordsPromise(object, filter) {

  const url = 'https://api.knackhq.com/v1/objects/' + object + '/records/'
  const search = '?rows_per_page=1000&filters=' + encodeURI(JSON.stringify(filter))
  const searchUrl = url + search
  const init = {
    method: 'GET',
    headers: myKnackHeaders
  }

  try {
    let response = await fetch(searchUrl, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    let records = await json.records
    return records
  } catch (err) {
    logError(filterViewPromise, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

// Builds a filter for Knack to be used for fetching multiple records
// Filter is for each ID in the array
function createFilterFromArrayOfIDs (arrRecordIDs) {
  if (!isItAnArray(arrRecordIDs)) {
    throw new Error('you must pass an array to getKnackRecordsUsingIDs')
  }
  let filter = {}
  filter.match = 'or'

  let rules = []
  arrRecordIDs.map(value => {
    rules.push({
      'field': 'id',
      'operator': 'is',
      'value': value
    })
  })

  filter.rules = rules
  return filter
}

// Function checks if the passed variable is an array
// Feturns true or false
function isItAnArray (array) {
  if (array.length === 0 || !Array.isArray(array)) {
    return false
  } else {
    return true
  }
}

// -------------------- ERROR HANDLING ---------------------

// Takes an error object, and a boolean that indicates if the error should be thrown again
// logError(*callingFunction*, arguments, err, Knack.getUserAttributes(), window.location.href, true)
async function logError(callerFunction, args, err, user, url, throwAgain) {

  let callerArgs = Array.prototype.slice.call(args) // Convert caller's arguements to an array
  let callerArgsNames = getParamNames(callerFunction) // Extract arguement variable names from function code
  let callerName = err.stack.split('\n')[1].trim().split(' ')[1].trim() // Get the name of the calling function from the Error stack

  // Build an error log entry, in this case for Slack
  let logMessage = `Error in *${callerName} (` + callerArgsNames.toString().replace(/,/g, ', ') + `)*:exclamation:\n`
  logMessage += '> *when*: ' + moment().format('LLLL') + '\n'
  logMessage += `> *user*: ${user.name} (${user.email})\n`
  logMessage += `> *url*: ${url} \n`
  for (var i = 0; i < callerArgs.length; ++i) {
    if (typeof callerArgsNames[i] === 'object' && callerArgsNames[i] !== null){ // Is the variable an object?
      // Put message in code bock if it's an object
      logMessage += `*${callerArgsNames[i]}*: ` + '```' + JSON.stringify(callerArgs[i]) + '```' + '\n'
    } else {
      logMessage += `> *${callerArgsNames[i]}*: ` + JSON.stringify(callerArgs[i]).slice(0,500) + '\n'
    }
  }
  logMessage += '```' + err.stack + '```'
  await updateLog(logMessage) // Send message to Slack
  if (throwAgain) throw err // Optionally propogate the error
}

// Used by logError. Takes a function and returns the names of it's parameters
function getParamNames(func) {
  const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
  const ARGUMENT_NAMES = /([^\s,]+)/g;
  var fnStr = func.toString().replace(STRIP_COMMENTS, '');
  var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if (result === null)
    result = [];
  return result;
}

// Handles all logging from other functions
// Currently posts anything that gets raised here to Slack
function updateLog(entry) {
  let url = 'https://hooks.zapier.com/hooks/catch/2107870/jdigp6/'
  fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      log: entry
    })
  })
}

// Send webhook to Zapier
// endpoint: the zapier URL slug to send to
// dataObject: the data that needs to be sent to Zapier
// logEntry: the details that should be logged when this fires
async function triggerZap(endPoint, dataObject, logEntry) {
  const zapierAccount = '2107870/'
  const rootURL = 'https://hooks.zapier.com/hooks/catch/'
  const url = rootURL + zapierAccount + endPoint
  const init = {
    method: 'POST',
    body: JSON.stringify(dataObject)
  }

  try {
    await fetch(url, init)
    await updateLog(':heavy_check_mark: ' + logEntry)
  } catch (err) {
    logError(triggerZap, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

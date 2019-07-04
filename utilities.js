async function trackChanges(targetObject, originalViewData, view, callback) {



  // Array of events that can modify a record and need to be tracked
  let trackedEvents = [
    `knack-record-create.${view.key}`,
    `knack-record-update.${view.key}`,
    `knack-cell-update.${view.key}`,
    `knack-record-delete.${view.key}`
  ]

  // To track changes we need to have a snapshot of the original record
  let originalRecord = {}

  // Exit if the view has no source (it's a menu)
  if (view.source === undefined) return
  // Exit if it's a 'pseudo' celleditor view
  if (view.key.indexOf('_celleditor') > 0) return
  // Exit if it's not displaying the object we want to track
  if (view.source.object !== targetObject) return
  // Exit if a table, no inline editing, no action links, no delete link
  // if( a && ( b || c )) return
  // if action update 'Original Data' to be full details of all records in the table
  // if( actionlink ){
  // let recordIDs = orignaViewData.map(record => record.id)
  // let filter = createFilterFromArrayOfIDs(recordIDs)
  // originalViewData = await searchRecordPromise(targetObject,filter)
  //
  // Add a listener to the action link
  // $('kn-action-link').on('click',function(){
  //  window.actionLinkTracker = {}
  // actionLinkTracker[view.key] = true
  // })
  //}
  // Update forms don't load all fields, need to get full data to catch changes via record rules
  if (view.action === 'update') originalRecord = await getRecordPromise(view.source.object, originalViewData.id)
  // For brand new records there is no original, but knack passes the default values of an empty form
  if (view.action === 'insert') originalRecord = null

  // Global variable to keep track of views that already have listeners so they are only added once
  window.viewLoadTracker = {}
  // Add event listeners if not already listenting
  if(!viewLoadTracker[view.key]) {
    $(document).on(trackedEvents.join(' '), handler)
    viewLoadTracker[view.key] = true // Flag that this view has already had a lister attached to it - inline edits and forms can be loaded multiple times
  }

  // If there's no action link event, i'll need to identify these in the view
  // And add my own listener for if they are clicked
  // If it is clicked, can I navigate up the DOM tree and find the record ID?
  // If so, can I then get the record and pass this info to my standard handler?
  // Does the handler get added globally or for each element?

  // Function that fires after one of the tracked events. Can't be anonymous as need to remove it after firing
  function handler(event, view, updatedRecord) {
    // Original data via inline edits is an array, not a record object, needs special treatment
    if (isItAnArray(originalViewData)) {
      // If the source view is a table (inline edit) need to identify the actual previous record
      originalRecord = originalViewData.filter(tableRecord => tableRecord.id === updatedRecord.id)[0]
      // The updated record includes all fields, need to strip the one not also in the original or will show false changes
      Object.keys(updatedRecord).forEach(key => {
        if (originalRecord[key] === undefined) {
          delete updatedRecord[key]
        }
      })
      // In order to capture futher changes via inline edit, need to update the original view data
      let targetRecordIndex = originalViewData.findIndex(record => record.id === updatedRecord.id)
      originalViewData[targetRecordIndex] = updatedRecord
    } else {
      // Other views can also be reloaded multiple times
      originalViewData = updatedRecord
    }

    record = createChangeRecord(originalRecord, updatedRecord)
    record.event = view.action // insert, update
    callback(record)
  }

  function createChangeRecord(orginalRecord, updatedRecord) {
    // Copy updated data to a new record
    let record = JSON.parse(JSON.stringify(updatedRecord))

    record.updatedFields = []
    record.previous = {}
    // Create a full set of previous records on the record
    // Loop through the updatedRecord and for each key, assign the record.previous value to the orginalRecord value
    Object.keys(updatedRecord).forEach(key => {
      // If there is a previous record, populate the previous property with value
      if (originalRecord) {
        if (originalRecord[key] !== undefined) {
          record.previous[key] = orginalRecord[key]
        } else {
          record.previous[key] = ''
        }
      } else {
        record.previous[key] = ''
      }
      // If the field has changed, add the field name to change tracking array
      if (record[key] !== record.previous[key] && key.indexOf('raw') < 0) {
        record.updatedFields.push(key)
      }
    })
    // Flag if anything has changed
    record.isChanged = record.updatedFields.length > 0 ? true : false

    return record
  }
}

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
  return fieldValue.toString().match(dateRegex)
}

function isToFromDateFieldType(fieldValue) {
  let dateRegex = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}.*(to).*/
  return fieldValue.toString().match(dateRegex)
}

function isObjectUpdated(object, arrayOfFieldPairs) {
  return arrayOfFieldPairs.some((fieldPair) => {
    return JSON.stringify(object[fieldPair[0]]) !== JSON.stringify(object[fieldPair[1]])
  })
}

// Compares two fields, a 'live' field and a 'previous' value field
// If live field is not blank, and the previous field is, assumed that just updated
// fieldPair is array: [liveField, previousField]
function isFieldJustAdded(object, fieldPairArray) {
  return object[fieldPairArray[0]].length > 0 && object[fieldPairArray[1]].length === 0
}

// ---------------------- DATA MANAGEMENT ------------

//Return array of callOut IDs for any connection field
function getConnectionIDs(connectionArray) {
  if (connectionArray !== undefined) {
    return connectionArray.map(connection => connection.id)
  } else {
    return []
  }
}

//Return array of callOut identifiers for any connection field
function getConnectionIdentifiers(connectionArray) {
  if (connectionArray !== undefined) {
    return connectionArray.map(connection => connection.identifier)
  } else {
    return []
  }
}

// Updates record and returns the updated record
async function createRecordPromise(object, data) {
  const url = 'https://api.knackhq.com/v1/objects/' + object + '/records/'
  const init = {
    method: 'POST',
    headers: myKnackHeaders,
    body: JSON.stringify(data)
  }
  try {
    let response = await fetch(url, init)
    if (!response.ok) throw Error(response.statusText)
    let json = await response.json()
    return json
  } catch (err) {
    logError(updateRecordPromise, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

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
    logError(updateRecordPromise, arguments, err, Knack.getUserAttributes(), window.location.href, true)
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
    logError(searchRecordsPromise, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

// Builds a filter for Knack to be used for fetching multiple records
// Filter is for each ID in the array
function createFilterFromArrayOfIDs(arrRecordIDs) {
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
function isItAnArray(array) {
  if (array.length === 0 || !Array.isArray(array)) {
    return false
  } else {
    return true
  }
}

// -------------------- UI MANIPULATION  ---------------------

function hideEmptyTables(scene) {
  //Iterate throught each view in the page
  scene.views.map(function(view) {
    // If the view has row data (ie it's a table) AND that data is 0...
    if (view.type === 'table' && Knack.models[view.key].data.length === 0) {
      $('#' + view.key).remove()
    }
  })
}

// Function that adds checkboxes
var addCheckboxes = function(view) {
  // Add the checkbox to to the header to select/unselect all
  $('#' + view.key + '.kn-table thead tr').prepend('<th><input type="checkbox"></th>');
  $('#' + view.key + '.kn-table thead input').change(function() {
    $('.' + view.key + '.kn-table tbody tr input').each(function() {
      $(this).attr('checked', $('#' + view.key + '.kn-table thead input').attr('checked') != undefined);
    });
  });
  // Add a checkbox to each row in the table body
  $('#' + view.key + '.kn-table tbody tr').not('.kn-table-group').each(function() {
    $(this).prepend('<td><input type="checkbox"></td>');
  });
  // Group headings need the extra cell to format correctly
  $('#' + view.key + '.kn-table tbody tr.kn-table-group').each(function() {
    $(this).prepend('<td></td>');
  });
}

//https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
// Version 4.0
const pSBC = (p, c0, c1, l) => {
  let r, g, b, P, f, t, h, i = parseInt,
    m = Math.round,
    a = typeof(c1) == "string";
  if (typeof(p) != "number" || p < -1 || p > 1 || typeof(c0) != "string" || (c0[0] != 'r' && c0[0] != '#') || (c1 && !a)) return null;
  if (!this.pSBCr) this.pSBCr = (d) => {
    let n = d.length,
      x = {};
    if (n > 9) {
      [r, g, b, a] = d = d.split(","), n = d.length;
      if (n < 3 || n > 4) return null;
      x.r = i(r[3] == "a" ? r.slice(5) : r.slice(4)), x.g = i(g), x.b = i(b), x.a = a ? parseFloat(a) : -1
    } else {
      if (n == 8 || n == 6 || n < 4) return null;
      if (n < 6) d = "#" + d[1] + d[1] + d[2] + d[2] + d[3] + d[3] + (n > 4 ? d[4] + d[4] : "");
      d = i(d.slice(1), 16);
      if (n == 9 || n == 5) x.r = d >> 24 & 255, x.g = d >> 16 & 255, x.b = d >> 8 & 255, x.a = m((d & 255) / 0.255) / 1000;
      else x.r = d >> 16, x.g = d >> 8 & 255, x.b = d & 255, x.a = -1
    }
    return x
  };
  h = c0.length > 9, h = a ? c1.length > 9 ? true : c1 == "c" ? !h : false : h, f = pSBCr(c0), P = p < 0, t = c1 && c1 != "c" ? pSBCr(c1) : P ? {
    r: 0,
    g: 0,
    b: 0,
    a: -1
  } : {
    r: 255,
    g: 255,
    b: 255,
    a: -1
  }, p = P ? p * -1 : p, P = 1 - p;
  if (!f || !t) return null;
  if (l) r = m(P * f.r + p * t.r), g = m(P * f.g + p * t.g), b = m(P * f.b + p * t.b);
  else r = m((P * f.r ** 2 + p * t.r ** 2) ** 0.5), g = m((P * f.g ** 2 + p * t.g ** 2) ** 0.5), b = m((P * f.b ** 2 + p * t.b ** 2) ** 0.5);
  a = f.a, t = t.a, f = a >= 0 || t >= 0, a = f ? a < 0 ? t : t < 0 ? a : a * P + t * p : 0;
  if (h) return "rgb" + (f ? "a(" : "(") + r + "," + g + "," + b + (f ? "," + m(a * 1000) / 1000 : "") + ")";
  else return "#" + (4294967296 + r * 16777216 + g * 65536 + b * 256 + (f ? m(a * 255) : 0)).toString(16).slice(1, f ? undefined : -2)
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
    if (typeof callerArgsNames[i][0] === '{' && callerArgsNames[i] !== null) { // Is the variable an object?
      // Put message in code bock if it's an object
      logMessage += `*${callerArgsNames[i]}*: ` + '```' + JSON.stringify(callerArgs[i]) + '```' + '\n'
    } else {
      logMessage += `> *${callerArgsNames[i]}*: ` + JSON.stringify(callerArgs[i]).slice(0, 500) + '\n'
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
  let url = 'https://hooks.zapier.com/hooks/catch/2107870/vdgohy/'
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

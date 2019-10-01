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
  // Remove repeat and all day options
  $('#kn-input-' + fieldId.split('-')[1] + ' > div:nth-child(3)').remove()

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
    if (view.type === 'table' && Knack.models[view.key]) {
      if (Knack.models[view.key].data.length === 0) {
        $('#' + view.key).remove()
      }
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
  Sentry.captureException(err)
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
  } catch (err) {
    logError(triggerZap, arguments, err, Knack.getUserAttributes(), window.location.href, true)
  }
}

// Adds a text box under a contact object to expose email and phone
// Allows editing in conjunction with popover function
async function displayContactDetails(contactId, field) {
  if (!contactId) return
  let $siteContactDetails = $('#site-contact-details')
  if ($siteContactDetails.length === 0) {
    $('#connection-picker-chosen-' + field).append('<div id="site-contact-details">Loading...</div>')
    $siteContactDetails = $('#site-contact-details')
  } else if ($siteContactDetails[0].innerText.indexOf('Loading') > -1) {
    return
  } else {
    $siteContactDetails[0].innerText = 'Loading...'
  }
  let contactObj = new KnackObject(objects.contacts)
  let siteContact = await contactObj.get(contactId)
  displayDetails()

  function displayDetails() {
    let phone = siteContact.field_231_raw ? siteContact.field_231_raw : ''
    let email = siteContact.field_76_raw ? siteContact.field_76_raw.email : ''
    let html = `<strong>mobile:</strong> ${phone} <a id='edit-mobile'>edit</a><br><strong>email:</strong> ${email} <a id='edit-email'>edit</a>`
    $('#site-contact-details').html(html)

    $('#edit-mobile').click(function() {
      getInlineUserInput('Phone', phone, '#edit-mobile', async function(newNumber) {
        try {
          $('#site-contact-details').html('Loading...')
          siteContact = await contactObj.update(siteContact.id, {
            'field_231': newNumber
          })
          displayDetails()
        } catch (err) {
          Sentry.captureException(err)
        }
      })
    })

    $('#edit-email').click(function() {
      getInlineUserInput('Email', email, '#edit-email', async function(newEmail) {
        try {
          $('#site-contact-details').html('Loading...')
          siteContact = await contactObj.update(siteContact.id, {
            'field_76': newEmail
          })
          displayDetails()
        } catch (err) {
          Sentry.captureException(err)
        }
      })
    })
  }
}

// Creates a popover to collect user input
// Places the popover relative to the passed in selector
// Callback takes a single parameter - the value of the user input
function getInlineUserInput(title, defaultValue, selector, callback) {
  // Don't duplicate the popover
  if ($('#popover-input').length > 0) return
  // Insert the popover into the page
  let inputModalHtml = `<div class="drop kn-popover drop-target-attached-top" id="popover-input"> <div class="drop-content"> <h1 class="kn-title">${title}<span class="close-popover fa fa-times"></span></h1> <div> <div class="renderer-form kn-form"> <form> <ul class="kn-form-group columns kn-form-group-1"> <li class="kn-form-col column is-constrained"> <div class="kn-input kn-input-short_text control" id="kn-input-field_1477" data-input-id="field_1477"> <div class="control"> <input class="input"> </div> </div> </li> </ul> </form> </div> <div class="submit"><a class="kn-button is-primary save prevent-close trigger-load">Submit</a></div> </div> </div> </div>`
  $('body').append(inputModalHtml)
  // Format and position popover
  let $input = $('#popover-input')
  $input.find('.input')[0].value = defaultValue
  $input.css({
    'position': 'fixed'
  })
  let offset = $(selector).offset()
  let inputHeight = $input.outerHeight()
  let inputWidth = $input.width()
  offset.left = (offset.left - inputWidth / 2)
  offset.top = (offset.top - inputHeight)
  $input.offset(offset)

  // add close listener
  $input.find('span').click(function() {
    $input.remove()
  })

  // add submit listener
  $input.find('a').click(function() {
    callback($input.find('input')[0].value)
    $input.remove()
    // need to consider error handling here
  })
}

// Accepts an array of record objects and attempts to create a job activty record for each
// Object should look like
// {
//  field_1655 : 'Created by name'
//  field_579 = ['jobId']
//  field_1659 = ['activityRecordType'] // Job Created
//  field_576 = 'Details of the change'
// }
async function addJobActivityRecords(records) {
  if (!isItAnArray(records) || records.length === 0) throw Error('Job Activities Records must be in an array')
  try { // Create the records
    let recordsObj = new KnackObject(objects.activityRecords)
    for (let i = 0; i < records.length; i++) {
      await recordsObj.create(records[i])
    }
  } catch (err) {
    Sentry.captureException(err)
  }
}

// Send required data to Zapier to update portal
function changeStatusInPortal({
  jobId,
  newPortalState,
  date
}) {
  let data = {
    'jobId': jobId,
    'changeStateTo': newPortalState,
    'measure_booked_date': date,
    'date_of_install': date
  }
  triggerZap('vdv8sq', data, 'Portal state changed')
  Swal.fire({
    position: 'top-end',
    type: 'success',
    title: '<span style="font-size:16px;">Portal status updated</span>',
    showConfirmButton: false,
    showCloseButton: true,
    timer: 2000,
    backdrop: false,
    width: 300,
    padding: 10,
    background: '#e5ffe5'
  })
}

function makeFieldsRequired(view, fields = []) {

  let $view = $('#' + view.key)

  // Add the required asterix
  fields.forEach(field => {
    let $field = $('#kn-input-' + field)
    $field.find('label').append('<span class="kn-required">&nbsp;*</span>')
  })

  // Get the submit function for later
  let submitFunction = $._data($view[0]).events.submit[0].handler

  // Replace the submit button
  let $submitButton = $(`#${view.key} > form > div`)
  let newButtonHTML = `
  <div class="kn-submit" id="new-submit">
    <div class="kn-button is-primary" type="submit">
      ${$submitButton[0].innerText}
    </div>
  </div>`
  $submitButton.after(newButtonHTML).remove()
  let $newButton = $('#new-submit')

  // Replace the submit event with our own click event
  $newButton.on('click', function(event) {
    Knack.showSpinner()
    let isRequiredEntered = true
    let warningMessage = []

    // Remove any previous warnings
    $('.is-error-message').remove()

    // Check that a value has been supplied
    fields.forEach(field => {
      if ($(`#kn-input-${field}`).length > 0) {

        let $input = $(`#${view.key}-${field}`)
        let $connectionInput = $(`#${view.key}_${field}_chzn`)
        let value = $input[0].value

        if (value === '' && $input.closest('.kn-input').is(":visible")) {
          isRequiredEntered = false
          warningMessage.push(`<p><strong>${$('#kn-input-'+ field + ' label > span')[0].innerText} is required.</strong></p>`)

          if ($connectionInput.length > 0) {
            $connectionInput.find('a').addClass('input-error') // single selection
            $connectionInput.find('ul').addClass('input-error') // multi selection
          } else {
            $input.addClass('input-error') //.addClass('is-error')
          }
        }
      }
    })

    if (isRequiredEntered) {
      // call the original function
      submitFunction(event)
      //clickFunction(event)
    } else {
      let warning =
        `<div class="kn-message is-error is-error-message">
        <span class="kn-message-body">
          ${warningMessage.join('')}
        </span>
      </div>`

      if ($('.is-error-message').length === 0) $('#' + view.key + ' form').prepend(warning)

    }
    Knack.hideSpinner()
  })

}

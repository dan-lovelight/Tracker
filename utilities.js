// Limit the selectable time range to 6am to 8pm & show duration in to-time
// Takes a string for the target field id eg 'view_123-field_123'
function pimpTimePicker(view, fieldId) {
  // Set the time to 5am to 8pm
  $(`#${view.key}-${fieldId}-time`).timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': false
  });
  // Set the time to 5am to 8pm
  $(`#${view.key}-${fieldId}-time-to`).timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': true
  });
  // Remove repeat and all day options
  $('#kn-input-' + fieldId + ' > div:nth-child(3)').remove()

  // Update the start time of to-time for accurate duration when start time changes
  $(`input#${view.key}-${fieldId}-time`).on('focusout', function() {
    console.log('focusOut from time')
    $(`#${view.key}-${fieldId}-time-to`).timepicker('option', {
      minTime: $(`#${view.key}-${fieldId}-time`).val()
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

function hasNumber(myString) {
  return /\d/.test(myString);
}

function formatAsDollars(value) {

  //Create formatter
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  })

  return formatter.format(value)

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

// Checks if the field passed in is empty
function isFieldBank(object, fieldKey) {
  if (object[fieldKey] === "") return true
  return false
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
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
}

function pimpContactField(view, field) {
  // Get the target contact field
  let $contact = $(`#${view.key}-${field}`) // Need the jquery wrapper for later manipuation

  // Display details if the field is not blank
  if ($contact[0] && $contact[0].length) {
    if ($contact[0].length > 0) displayContactDetails($contact[0].value, field)
  }

  // Watch for changes in the field.
  $(`#${view.key}-${field}`).on('change', function() {
    if ($contact[0].length > 0) displayContactDetails($contact[0].value, field)
  })
}

// Adds a text box under a contact object to expose email and phone
// Allows editing in conjunction with popover function
async function displayContactDetails(contactId, field) {

  if (!contactId) return

  // Get any existing details that are displayed
  let $contactDetails = $('#contact-details')

  // Check for existing details
  if ($contactDetails.length === 0) {
    // Add div to hold contact details and display 'loading' to the user
    $('#connection-picker-chosen-' + field).append('<div id="contact-details">Loading...</div>')
    $contactDetails = $('#contact-details')
  } else if ($contactDetails[0].innerText.indexOf('Loading') > -1) {
    // Exit if already loading
    return
  } else {
    // Display 'loaing' to user
    $contactDetails[0].innerText = 'Loading...'
  }

  // Get the contact's details
  let contactObj = new KnackObject(objects.contacts)
  let contact = await contactObj.get(contactId)
  displayDetails(contact)

  function displayDetails(contact) {

    let name = contact.field_108_raw ? contact.field_108_raw.first + ' ' + contact.field_108_raw.last : ''
    let phone = contact.field_231_raw ? contact.field_231_raw : ''
    let email = contact.field_76_raw ? contact.field_76_raw.email : ''
    let sales = contact.field_997.length > 0 ? contact.field_997_raw[0].identifier : ''

    let html = `
      ${contact.field_108.length === 0 ? `<strong>name:</strong> ${name} <a id='edit-name'>edit</a><br>` :''}
      <strong>mobile:</strong> ${phone} <a id='edit-mobile'>edit</a><br>
      <strong>email:</strong> ${email} <a id='edit-email'>edit</a><br>
      <strong>owner:</strong> ${sales}
    `
    $('#contact-details').html(html)

    let editName = {
      title: 'Name',
      defaultValue: contact.field_108_raw,
      selector: '#edit-name',
      field: 'field_108',
      callback: executeInlineUpdate
    }

    let editPhone = {
      title: 'Phone',
      defaultValue: phone,
      selector: '#edit-mobile',
      field: 'field_231',
      callback: executeInlineUpdate
    }

    let editEmail = {
      title: 'Email',
      defaultValue: email,
      selector: '#edit-email',
      field: 'field_76',
      callback: executeInlineUpdate
    }

    $('#edit-name').click(function() {
      getInlineUserInput(editName)
    })

    $('#edit-mobile').click(function() {
      getInlineUserInput(editPhone)
    })

    $('#edit-email').click(function() {
      getInlineUserInput(editEmail)
    })

  }

  async function executeInlineUpdate(data) {
    try {
      $('#contact-details').html('Loading...')
      updatedContact = await contactObj.update(contact.id, data)
      displayDetails(updatedContact)
    } catch (err) {
      if (typeof Sentry === 'undefined') throw err
      Sentry.captureException(err)
    }
  }

}

// Creates a popover to collect user input
// Places the popover relative to the passed in selector
// Callback takes a single parameter - the value of the user input
function getInlineUserInput({
  title,
  defaultValue,
  selector,
  field,
  callback
}) {
  // Don't duplicate the popover
  if ($('#popover-input').length > 0) return

  let fieldType = Knack.objects.models.filter(object => object.id === objects.contacts)[0]
  fieldType = fieldType.fields.models.filter(find => find.id === field)
  fieldType = fieldType[0].attributes.type

  // editable field types - multiple_choice, connection, short_text, name, address, email, phone
  let inputHtml = ''

  if (fieldType === 'name') {
    inputHtml = `
      <div class="kn-input kn-input-name control">
        <div class="control is-grouped">
          <p class="control is-expanded">
            <input class="input" id="first" name="first" type="text" value="" placeholder="First">
          </p>
          <p class="control is-expanded">
            <input class="input" id="last" name="last" type="text" value="" placeholder="Last">
          </p>
        </div>
      </div>
    `
  } else if (['short_text', 'email', 'phone'].includes(fieldType)) {
    inputHtml = `
    <div class="kn-input kn-input-${fieldType} control">
      <div class="control">
        <input class="input">
      </div>
    `
  } else {
    throw new Error('unsupported field type')
  }

  // Insert the popover into the page
  let inputModalHtml = `
  <div class="drop kn-popover drop-target-attached-top" id="popover-input">
    <div class="drop-content">
      <h1 class="kn-title">${title}<span class="close-popover fa fa-times"></span></h1>
        <div>
          <div class="renderer-form kn-form">
            <form>
              <ul class="kn-form-group columns kn-form-group-1">
                <li class="kn-form-col column is-constrained">
                  ${inputHtml}
                  </div>
                </li>
              </ul>
            </form>
          </div>
          <div class="submit">
            <a class="kn-button is-primary save prevent-close trigger-load">
              Submit
            </a>
          </div>
        </div>
      </div>
    </div>
    `
  // Insert to edit popover
  $('body').append(inputModalHtml)

  // Format and position popover
  let $input = $('#popover-input')
  $input.css({
    'position': 'fixed'
  })
  let offset = $(selector).offset()
  let inputHeight = $input.outerHeight()
  let inputWidth = $input.width()
  offset.left = (offset.left - inputWidth / 2)
  offset.top = (offset.top - inputHeight)
  $input.offset(offset)

  // Set default value
  if (fieldType === 'name') {
    $input.find('.input')[0].value = defaultValue.first
    $input.find('.input')[1].value = defaultValue.last
  } else {
    $input.find('.input')[0].value = defaultValue
  }

  // add close listener
  $input.find('span').click(function() {
    $input.remove()
  })

  // add submit listener
  $input.find('a').click(function() {
    let updateData = {}
    if (fieldType === 'name') {
      updateData = `{
        "${field}" : {
          "first":"${$input.find('input')[0].value}",
          "last":"${$input.find('input')[1].value}"
        }
      }`
    } else {
      updateData = `{
        "${field}":"${$input.find('input')[0].value}"
      }`
    }
    callback(JSON.parse(updateData))
    $input.remove()
    // need to consider error handling here
  })
}

// Accepts an array of record objects and attempts to create a job activty record for each
// Object should look like
// {
//  field_1655 : 'Created by name'
//  field_579 = ['jobId']
//  field_1659 = ['activityRecordType'] // eg Job Created uuid
//  field_576 = 'Details of the change'
// }
async function addActivityRecords(records) {
  if (!isItAnArray(records) || records.length === 0) throw Error('Activities Records must be in an array')
  try { // Create the records
    let recordsObj = new KnackObject(objects.notes)
    for (let i = 0; i < records.length; i++) {
      await recordsObj.create(records[i])
    }
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
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

  // Replace the submit button
  let $submitButton = $(`#${view.key} > form > div`)
  let newButtonHTML = `
  <div class="kn-submit">
    <div class="kn-button is-primary" type="submit" id="new-submit">
      ${$submitButton[0].innerText}
    </div>
  </div>`
  $submitButton.after(newButtonHTML).hide()
  let $newButton = $('#new-submit')

  // Replace the submit event with our own click event
  $newButton.on('click', function(event) {
    // Check fields are OK
    checkRequiredFields(view, fields, function() {
      // Trigger submit if they are
      $submitButton.trigger('submit')
    })
  })

}

// callbackIfOK an optional callback function that will run if everything passes
// function returns true/false based on outcome
function checkRequiredFields(view, fields, callbackIfOK) {
  Knack.showSpinner()
  let isRequiredEntered = true
  let warningMessage = []

  // Remove any previous warnings
  $('.is-error-message').remove()
  $('.input-error').removeClass('input-error')

  // Check that a value has been supplied
  fields.forEach(field => {

    // Check short text field
    let $shortText = $(`.kn-input-short_text #${field}`)
    if ($shortText.length > 0) {
      if ($shortText.val() === '' && $shortText.closest('.kn-input').is(":visible")) {
        isRequiredEntered = false
        warningMessage.push(`<p><strong>${$('#kn-input-'+ field + ' label > span')[0].innerText} is required.</strong></p>`)
        $shortText.addClass('input-error')
      }
    } else if ($(`#kn-input-${field}`).length > 0) {

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
    if (callbackIfOK) callbackIfOK()
    Knack.hideSpinner()
    return true
  } else {
    let warning =
      `<div class="kn-message is-error is-error-message">
      <span class="kn-message-body">
        ${warningMessage.join('')}
      </span>
    </div>`

    if ($('.is-error-message').length === 0) $('#' + view.key + ' form').prepend(warning)
    Knack.hideSpinner()
    return false
  }

}

// takes the id of a file upload field
// processes the uploaded csv file and
// returns the processed file to the callback function
function getCSVFromField(fileInputId, callback) {

  if (!window.FileReader) return alert('FileReader API is not supported by your browser.')

  let $i = $('#' + fileInputId) // Put file input ID here
  let input = $i[0]; // Getting the element from jQuery

  if (input.files && input.files[0]) {

    try {
      file = input.files[0]; // The file
      fr = new FileReader(); // FileReader instance
      fr.readAsText(file);

      // This event fires after file is read
      fr.onload = function() {
        callback(fr.result)
      }
    } catch (err) {
      throw new Error('FileReader read error')
    }

  } else {
    alert("File not selected or browser incompatible.")
  }
}

//var csv is the CSV file with headers
function csvJSON(csv) {

  var lines = csv.split("\n");
  var result = [];
  var headers = lines[0].split(",");

  for (var i = 1; i < lines.length; i++) {

    var obj = {};
    var currentline = lines[i].split(",");

    if (currentline.length > 1) { // Excludes empty lines at the end of the csv file
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j].trim()] = currentline[j];
      }
      result.push(obj);
    }
  }

  return result //JSON
}

function getCurrentFiscalYear() {
  //get current date
  var today = new Date();

  //get current month
  var curMonth = today.getMonth() + 1;

  var fiscalYr = "";
  if (curMonth >= 6) { //
    fiscalYr = `FY${today.getFullYear()+1}`

  } else {
    fiscalYr = `FY${today.getFullYear()+1}`
  }
  return fiscalYr
}

function getCurrentFiscalQuarter() {
  //get current date
  var today = new Date();

  //get current month
  var curMonth = today.getMonth() + 1;

  let quarters = {
    "1": "FQ3",
    "2": "FQ3",
    "3": "FQ3",
    "4": "FQ4",
    "5": "FQ4",
    "6": "FQ4",
    "7": "FQ1",
    "8": "FQ1",
    "9": "FQ1",
    "10": "FQ2",
    "11": "FQ2",
    "12": "FQ2"
  }

  return quarters[curMonth]
}

function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

function getHeaders(service) {
  try {
    if ($('.kn-login').length > 0) return false
    return JSON.parse(CryptoJS.AES.decrypt(Knack.getUserAttributes().values.field_1676, Knack.getUserAttributes().values.field_1677).toString(CryptoJS.enc.Latin1))[service]
  } catch (err) {
    // This doesn't work if the user is not logged in.
  }
}

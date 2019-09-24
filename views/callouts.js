const hideTablesSchedulingScenes = [
  'knack-scene-render.scene_947', // My CallOuts Calendar view for schedulers
  'knack-scene-render.scene_1023', // Developments page
  'knack-scene-render.scene_981', // VIC Calendar
  'knack-scene-render.scene_982', // NSW Calendar
  'knack-scene-render.scene_983', // QLD Calendar
]

const createCallOutForms = [
  'knack-view-render.view_1437', // #jobs/view-job-details/{id}/add-a-call-out/{id}/, #pages/scene_641/views/view_1437
  'knack-view-render.view_1294', // #jobs/view-job-details/{id}/edit-call-out/{id}/, #pages/scene_576/views/view_1294
  'knack-view-render.view_2126', // #developments/view-development-details/{id}/, #pages/scene_1024/views/view_2126
  'knack-view-render.view_2207', // #upcoming/add-leaveunavailable/, #pages/scene_1057/views/view_2207
  'knack-view-render.view_2316', // #jobs/raise-service-call/, #pages/scene_1093/views/view_2316
]

// Add call out - via My Calendar
// https://lovelight.knack.com/tracker#my-calendar/
// https://builder.knack.com/lovelight/tracker#pages/scene_947/views/view_1962
$(document).on('knack-record-create.view_1962', function(event, view, record) {

  Swal.fire({
    title: "Updating callout...",
    text: "Please wait",
    showConfirmButton: false,
    onBeforeOpen: () => {
      Swal.showLoading()
    },
    onOpen: () => {
      let wait = setInterval(function() {
        // all callout record inserts are handled in objects/callouts.js
        // the processing function sets this global variable while in progress
        if (!window.callOutProcessing) {
          clearInterval(wait)
          window.location.replace(`${event.currentTarget.URL.split('?')[0]}edit-call-out/${record.id}`)
          Swal.close()
        }
      }, 100)
    }
  })
})

// Development Create Forms rendered
$(document).on('knack-view-render.view_2254 knack-view-render.view_2258', async function(event, view, data) {
  Knack.showSpinner()
  let development = await getRecordPromise(view.scene.object, view.scene.scene_id)

  let $siteContact = $('#' + view.key + '-field_1025') // Need the jquery wrapper for later manipuation
  let street = document.getElementById('street')
  let street2 = document.getElementById('street2')
  let city = document.getElementById('city')
  let state = document.getElementById('state')
  let zip = document.getElementById('zip')

  //Populate Site Contact
  if (development.field_417_raw) {
    if (development.field_417_raw.length > 0) {
      $siteContact.html(`<option value='${development.field_417_raw[0].id}'>${development.field_417_raw[0].identifier}</option>`).trigger('liszt:updated')
    }
  }
  //Populate Address
  street.value = development.field_199_raw.street
  street2.value = development.field_199_raw.street2 === undefined ? "" : development.field_199_raw.street2 // Only and issue for stree2, only sometimes... ?
  city.value = development.field_199_raw.city
  state.value = development.field_199_raw.state
  zip.value = development.field_199_raw.zip
  Knack.hideSpinner()
})


// Hide empty tables
$(document).on(hideTablesSchedulingScenes.join(' '), function(event, scene) {
  hideEmptyTables(scene)
});

// Create & Edit forms rendered
$(document).on(createCallOutForms.join(' '), function(event, view, data) {
  pimpTimePicker(view.key + '-field_924')
  addJobDetailsToCallOut(view)
  setDateTimeFromCalendar(view)
})

// ***************************************************************************
// ******************* REQUEST JOB MEASURE OR INSTALL *********************
// ***************************************************************************

$(document).on('knack-view-render.view_2107 knack-view-render.view_2346', function(event, view, data) {
  addJobDetailsToCallOut(view)
  // wait for the scene to be fully rendered
  $(document).on('knack-scene-render.' + view.scene.key, function(){
    positionDocumentTableAndForm(view)
  })

})


// ***************************************************************************
// ******************* WHEN A CALL EDIT FORM IS RENDERED *********************
// ***************************************************************************

function setDateTimeFromCalendar(view) {
  if (window.selectedTime) {
    // Set the date and time if the form has been loaded from the calendar
    $(`#${view.key}-field_924`)[0].value = window.selectedTime.fromDate
    $(`#${view.key}-field_924-time`)[0].value = window.selectedTime.fromTime
    $(`#${view.key}-field_924-time-to`)[0].value = window.selectedTime.toTime
    $(`#${view.key}-field_924-to`)[0].value = window.selectedTime.toDate
  }
  window.selectedTime = undefined
}

// Some details for a callout are taken directly from the associated job
// These can be set by record rule, but that doesn't give the user a chance to review them
// This function popualtes the callout record with job details when a form is loaded
function addJobDetailsToCallOut(view) {

  // Gather existing callout fields
  let selectedJob = document.getElementById(view.key + '-field_928')
  let $siteContact = $('#' + view.key + '-field_1025') // Need the jquery wrapper for later manipuation
  let street = document.getElementById('street')
  let street2 = document.getElementById('street2')
  let city = document.getElementById('city')
  let state = document.getElementById('state')
  let zip = document.getElementById('zip')

  // If creating a new callout for the job context, populate details from the job
  if (view.scene.object === 'object_3') {
    populateSiteContactAndAddress(view.scene.scene_id)
  } else {
    if ($siteContact[0].length) {
      if ($siteContact[0].length > 0) displayContactDetails($siteContact[0].value, 'field_1025')
    }
  }

  // Add a listner for changes in site contact selection
  $('#' + view.key + '-field_1025').on('change', async function() {
    if ($siteContact[0].length > 0) displayContactDetails($siteContact[0].value, 'field_1025')
  })

  // If the job field doesn't exists, exit here
  if (!selectedJob) return

  // Populate site and address details if these are blank but there is a job
  if (selectedJob.value.length > 0 && ($siteContact[0].value + street.value + street2.value + city.value + state.value + zip.value).length === 0) {
    populateSiteContactAndAddress(selectedJob.value)
  }

  // Store original value
  let originalJob = selectedJob.value

  // Add a listner for changes in job selection
  $('#' + view.key + '-field_928').on('change', async function() {
    let newJob = selectedJob.value
    let qtySelections = selectedJob.selectedOptions.length
    if (originalJob.length === 0 && newJob.length !== 0 && qtySelections === 1) {
      populateSiteContactAndAddress(newJob)
    }
    originalJob = newJob
  })


  async function populateSiteContactAndAddress(jobId) {
    Knack.showSpinner()
    try { // Get the job deatils
      let job = await getRecordPromise('object_3', jobId)
      //Populate Site Contact
      if (job.field_432_raw) {
        if (job.field_432_raw.length > 0) {
          $siteContact.html(`<option value='${job.field_432_raw[0].id}'>${job.field_432_raw[0].identifier}</option>`).trigger('liszt:updated')
          displayContactDetails(job.field_432_raw[0].id, 'field_1025')
        }
      }
      //Populate Address
      if (job.field_12_raw) {
        if (job.field_12_raw.street) street.value = job.field_12_raw.street
        if (job.field_12_raw.street2) street2.value = job.field_12_raw.street2
        if (job.field_12_raw.city) city.value = job.field_12_raw.city
        if (job.field_12_raw.state) state.value = job.field_12_raw.state
        if (job.field_12_raw.zip) zip.value = job.field_12_raw.zip
      }
    } catch (err) {
      Sentry.captureException(err)
    } finally {
      Knack.hideSpinner()
    }
  }
}

function positionDocumentTableAndForm(view){
  // Get an array of document tables in the same scene as the view
  let docsTable = view.scene.views.filter(view => view.source.object === 'object_22' && view.type ==='table')
  // If there is only one, let's put it where it needs to be
  if (docsTable.length === 1){
    // Add the docs table
    $('#' + docsTable[0].key).insertBefore('#' + view.key + ' .is-primary').css('display', 'block')
  }

  let docsForm = view.scene.views.filter(view => view.source.object === 'object_22' && view.type ==='form')

  if (docsForm.length === 1){

    // Add the docs form
    let formId = '#' + docsForm[0].key
    // Move the upload form into the callout form
    $(formId).insertBefore('#' + view.key + ' .is-primary').css('display', 'block')

    // Format the submit button
    formatSubmitButton(formId)

    //Hide the upload form
    $(formId).hide()

    // Add a link to show the upload form
    if($('#show-upload').length ===0) $('#' + docsTable[0].key).append(`<a id="show-upload" class="pull-right">Upload another</a>`)

    // Add listener to show the upload form
    $('#show-upload').on('click',function(){
      $(this).hide()
      $(formId).show()
    })

    // Add listner to apply formats after a document is uploaded
    $(document).on('knack-view-render.' + docsForm[0].key, function(event, view, data) {
      // Format the submit button
      formatSubmitButton(formId)
    })

  }
  function formatSubmitButton(formId){

    // Move the submit button into the third column (relies of form having 3 columns)
    // The DOM changes after a submission, need to test for two different selectors
    let $buttonPosition = $('#' + docsForm[0].key + ' > form > ul > li:nth-child(3)')
    if($buttonPosition.length === 0) $buttonPosition = $('#' + docsForm[0].key + ' > ul > li:nth-child(3)')
    $buttonPosition.prepend($(formId + ' .kn-submit'))

    // Format the button
    $(formId + ' .kn-submit').addClass('pull-right').css({
      'margin-top': '21px',
      'margin-right': '10px'
    })
    $(formId + ' button').removeClass('is-primary').addClass('is-secondary')
  }
}




// <div class="kn-primary pull-right" style="
//     margin-top: 21px;
//     margin-right: 10px;
// ">
// ***************************************************************************
// ******************* SERVICE CALLS *********************
// ***************************************************************************

// Add a new service call
$(document).on('knack-view-render.view_2314 knack-view-render.view_2316', function(event, view, data) {
  addJobDetailsToCallOut(view)

  // Add a listner for changes in invoicing time
  let $invoiceTime = $('#' + view.key + '-field_1625')
  $invoiceTime.on('change', async function() {
    if ($invoiceTime[0].value.indexOf('Before') > -1) {
      $('#' + view.key + ' > form > div > button')[0].innerText = 'Submit >> Create Invoice'
    } else {
      $('#' + view.key + ' > form > div > button')[0].innerText = 'Submit'
    }
  })

});

// Submit service call request
$(document).on('knack-form-submit.view_2314 knack-form-submit.view_2316', async function(event, view, record) {
  if (record.field_1625.indexOf('Before') > -1) {
    Knack.showSpinner()
    try {
      let invoice = await createCallOutInvoice(record)
      window.location.replace(`${event.currentTarget.URL.split('?')[0]}invoice-call-out/${invoice.id}`)
    } catch (err) {
      Sentry.captureException(err)
    } finally {
      Knack.hideSpinner()
    }
  }
});

// Finalise invoicing for completed callout
$(document).on('knack-form-submit.view_2305', async function(event, view, record) {
  Knack.showSpinner()
  try {
    let invoice = await createCallOutInvoice(record)
    window.location.replace(`${event.currentTarget.URL.split('?')[0]}invoice-call-out/${invoice.id}`)
  } catch (err) {
    Sentry.captureException(err)
  } finally {
    Knack.hideSpinner()
  }
});

// Expose invoicing contact details on invoice form
$(document).on('knack-view-render.view_2297', async function(event, view, data) {
  displayContactDetails(data.field_1396_raw[0].id, 'field_1396')
})

// Raise invoice in Xero for a callout
$(document).on('knack-form-submit.view_2297', async function(event, view, record) {
  issueInvoice(record)
})

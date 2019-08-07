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
})

// ***************************************************************************
// ******************* WHEN A CALL EDIT FORM IS RENDERED *********************
// ***************************************************************************

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
    if ($siteContact[0].length > 0) displaySiteContactDetails($siteContact[0].value)
  }

  // Add a listner for changes in site contact selection
  $('#' + view.key + '-field_1025').on('change', async function() {
    if ($siteContact[0].length > 0) displaySiteContactDetails($siteContact[0].value)
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
          displaySiteContactDetails(job.field_432_raw[0].id)
        }
      }
      //Populate Address
      if (job.field_12_raw) {
        street.value = job.field_12_raw.street
        street2.value = job.field_12_raw.street2 === undefined ? "" : job.field_12_raw.street2 // Only and issue for stree2, only sometimes... ?
        city.value = job.field_12_raw.city
        state.value = job.field_12_raw.state
        zip.value = job.field_12_raw.zip
      }
    } catch (err) {
      Sentry.captureException(err)
    } finally {
      Knack.hideSpinner()
    }
  }

  async function displaySiteContactDetails(siteContactId) {
    let $siteContactDetails = $('#site-contact-details')
    if ($siteContactDetails.length === 0) {
      $('#connection-picker-chosen-field_1025').append('<div id="site-contact-details">Loading...</div>')
      $siteContactDetails = $('#site-contact-details')
    } else if ($siteContactDetails[0].innerText.indexOf('Loading') > -1) {
      return
    } else {
      $siteContactDetails[0].innerText = 'Loading...'
    }
    let contactObj = new KnackObject(objects.contacts)
    let siteContact = await contactObj.get(siteContactId)
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
}

// ***************************************************************************
// ******************* SERVICE CALLS *********************
// ***************************************************************************

// Add a new service call
$(document).on('knack-view-render.view_2286', function(event, view, data) {
  addJobDetailsToCallOut(view)

  // Add a listner for changes in invoicing time
  let $invoiceTime = $('#' + view.key + '-field_1625')
  $invoiceTime.on('change', async function() {
    if($invoiceTime[0].value.indexOf('Before')>-1){
      $('form > div > button')[0].innerText = 'Submit >> Create Invoice'
    } else {
      $('form > div > button')[0].innerText = 'Submit'
    }
  })

});

// Submit service call request
$(document).on('knack-form-submit.view_2286', async function(event, view, record) {
  if (record.field_1625.indexOf('Before')>-1) {
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

// Raise invoice in Xero for a callout
$(document).on('knack-form-submit.view_2297', async function(event, view, record) {
  issueInvoice(record)
})

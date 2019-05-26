//***************************************************************************
//******************* WHEN CREATE/EDIT CALL OUT FORMS ARE RENDERED **********
//***************************************************************************

// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/add-a-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_641/views/view_1437
$(document).on('knack-view-render.view_1437', function(event, view, data) {
  pimpTimePicker('view_1437-field_924')
})

// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/edit-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_576/views/view_1294
$(document).on('knack-view-render.view_1294', function(event, view, data) {
  pimpTimePicker('view_1294-field_924')
});

// https://lovelight.knack.com/tracker#developments/view-development-details/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_1024/views/view_2126
$(document).on('knack-view-render.view_2126', function(event, view, data) {
  pimpTimePicker('view_2126-field_924')
});

// ***************************************************************************
// ******************* WHEN A CALL OUT IS UPDATED ****************************
// ***************************************************************************

async function processCallOutChanges(record) {
  try {
    let updatedRecord = await updateCallOutDataForChanges(record)
    return updateCallOutCalendarEvents(record, updatedRecord)
  } catch (err) {
    errorHandler(err, record)
  }
}

function updateCallOutDataForChanges(callOut) {
  return Promise.try(function() {
      let promiseArray = [getCallOutChangeResetData(callOut), getCallOutUpdateDataFromJob(callOut), getCallOutUpdateNameData(callOut)]
      return Promise.all(promiseArray)
    })
    .spread((reset, job, name) => {
      let updateData = {
        ...reset,
        ...job,
        ...name
      }
      if (Object.entries(updateData).length === 0) {
        console.log('No updates required')
        return callOut
      } else {
        return updateRecordByID('callouts', callOut.id, updateData)
      }
    })
}

// Compare the current value of key fields with the stored previous value
async function getCallOutChangeResetData(callOut) {

  let fieldsToCheck = [
    ['field_924', 'field_1026'], // Scheduled Date
    ['field_927', 'field_1034'], // Installer
    ['field_985', 'field_1504'], // Salesperson
    ['field_1474', 'field_1505'], // Ops person
    ['field_1503', 'field_1506'], // Other attendees
    ['field_981', 'field_1478'], // Address
    ['field_955', 'field_1028'], // Status
    ['field_925', 'field_1492'], // Type
    ['field_928', 'field_1493'], // Job
  ]

  // If there are any changes, return object to update all 'previous' fields
  if (isObjectUpdated(callOut, fieldsToCheck)) {
    return copyFieldsToNewObject(callOut, fieldsToCheck)
  }
  return {}
}

async function getCallOutUpdateDataFromJob(callOut) {
  let calloutJobFields = ['field_928', 'field_1493'] // Live jobs field, previous jobs field
  let isJobDataRequired = isFieldJustAdded(callOut, calloutJobFields)
  console.log(isJobDataRequired ? 'Call out now has a job: update details from job' : 'Job has not changed')

  return isJobDataRequired ? getJobData(callOut) : {}
}

async function getJobData(callOut) {

  let job = await getRecordPromise('object_3', callOut.field_928_raw[0].id)

  let fieldsToCopy = [
    ['field_1276', 'field_985'], // Salesperson
    ['field_1277', 'field_1474'], // Ops person
    ['field_58', 'field_1494'], // State
    ['field_186', 'field_1482'], // Development
    ['field_59', 'field_1495'], // Busines Unit
  ]

  let addressFieldsToCopy = [
    ['field_12', 'field_981'], // Address
    ['field_12', 'field_1478'], // Previous address (to remove has changed flag)
  ]

  let siteContactFieldsToCopy = [
    ['field_432', 'field_1025'] // Site contact
  ]

  // Copy site contact if required
  if (callOut.field_1024 === 'Yes') {
    fieldsToCopy = fieldsToCopy.concat(siteContactFieldsToCopy)
  }
  // Copy address (and to previous address to remove flag) if required
  if (callOut.field_982 === 'Yes') {
    fieldsToCopy = fieldsToCopy.concat(addressFieldsToCopy)
  }

   // Preprocess the job business unit
  (job.field_59 === 'Apartments' || job.field_59 === 'Projects') ? job.field_59 = ['Commercial']: [job.field_59]

  return updateData = copyFieldsToNewObject(job, fieldsToCopy)
}

function getCallOutUpdateNameData(callOut) {
  return Promise.try(() => {
    let isInstallerUpdated = JSON.stringify(callOut.field_1034) !== JSON.stringify(callOut.field_927)
    let isStatusUpdated = JSON.stringify(callOut.field_955) !== JSON.stringify(callOut.field_1028)
    let isTypeUpdated = JSON.stringify(callOut.field_925) !== JSON.stringify(callOut.field_1492)
    let isJobUpdated = JSON.stringify(callOut.field_928) !== JSON.stringify(callOut.field_1493)
    let countInstallers = callOut.field_927.length > 0 ? callOut.field_927_raw.length : 0

    if (isTypeUpdated || isJobUpdated || isStatusUpdated || (isInstallerUpdated && countInstallers > 1)) {
      return getCallOutName(callOut)
        .then((name) => {
          let updateData = {}

          updateData.field_1481 = name.calendarName
          updateData.field_1488 = name.formName
          updateData.field_1490 = name.statusTypeInstallers

          return updateData
        })
    } else {
      console.log('No name update required')
      return {}
    }
  })
}

// A callout has been created or updated. What should we do?
function updateCallOutCalendarEvents(callOut, updatedCallOut) {
  return Promise.try(function() {
    // Variables that tell us if the callout has been updated
    let isTimeUpdated = JSON.stringify(callOut.field_1026) !== JSON.stringify(callOut.field_924)
    let isInstallerPresent = callOut.field_927.length > 0 ? true : false
    let isInstallerUpdated = JSON.stringify(callOut.field_1034) !== JSON.stringify(callOut.field_927)
    let isAddressUpdated = JSON.stringify(callOut.field_981) !== JSON.stringify(callOut.field_1478)
    let isTypeUpdated = JSON.stringify(callOut.field_925) !== JSON.stringify(callOut.field_1492)
    let isJobUpdated = JSON.stringify(callOut.field_928) !== JSON.stringify(callOut.field_1493)
    let isAdditionalAttendeeUpdated = JSON.stringify(callOut.field_1503) !== JSON.stringify(callOut.field_1506)

    // Variables that tell us what we need to do this this callout
    let isConfirmed = callOut.field_955 === 'No' // If the callout is not 'Tentative' then it is isConfirmed
    let isInCalendar = callOut.field_1082.length > 1 // If the callout has a matching calendar item the id will be in this field
    let isUpdated = (isTimeUpdated || isInstallerUpdated || isAddressUpdated || isTypeUpdated || isJobUpdated || isAdditionalAttendeeUpdated)
    let isUpdateInProgress = callOut.field_1101 === 'Yes'
    let isCancelled = callOut.field_1005 === 'Cancelled'

    // |isConfirmed|isInCalendar|isUpdated|isUpdateInProgress|ACTION|
    // |-----------|------------|---------|------------------|------|
    // |   any     |    any     |  any    |       true       |nothing|
    // |   true    |    false   |  any    |       false      |CREATE|
    // |   true    |    true    |  true   |       false      |UPDATE|
    // |   false   |    true    |  any    |       false      |DELETE|
    // |   true    |    true    |  false  |       false      |nothing|
    // |   false   |    false   |  any    |       false      |nothing|

    // only proceed if there's no change already underway
    if (isUpdateInProgress) {
      console.log('updateCallOutCalendarEvents ran: Update already in progress, didn\'t create event')
      return updatedCallOut
    } else if (isConfirmed && !isInCalendar && !isCancelled && isInstallerPresent) {
      console.log('updateCallOutCalendarEvents ran: Need to create a new event')
      return createGoogleEvent(updatedCallOut)
    } else if (isConfirmed && isUpdated && !isCancelled && isInstallerPresent) {
      console.log('updateCallOutCalendarEvents ran: Need to update an existing event')
      return updateGoogleEvent(updatedCallOut)
    } else if ((!isConfirmed && isInCalendar) || (isInCalendar && isCancelled) || (isInCalendar && !isInstallerPresent)) {
      console.log('updateCallOutCalendarEvents ran: Need to delete an existing event')
      return deleteGoogleEvent(updatedCallOut)
    } else {
      console.log('updateCallOutCalendarEvents ran: No update required to calendar events')
      return updatedCallOut
    }
  })
}

// Create the display name for the call out
function formatCallOutName(callOut) {
  return Promise.try(function() {
      let name = {}

      // Show if the bookings is confirmed or tentative
      name.confirmationIcon = callOut.field_955 === 'No' ? '' : '[❓]' // Show confirmed / tentative status
      name.type = callOut.field_925 // The selected callout type - install, measure etc
      name.typeIcon = ''
      name.jobsCount = callOut.field_928.length > 0 ? callOut.field_928_raw.length : 0
      name.jobsCountDisplay = name.jobsCount > 1 ? '(+' + (name.jobsCount - 1) + ' others)' : ''
      name.firstJob = name.jobsCount > 0 ? callOut.field_928_raw['0'].identifier : ''
      name.firstJobNoNumbers = name.jobsCount > 0 ? name.firstJob.split('-').shift().replace(/[0-9]/g, '') + '-' + name.firstJob.split('-')['1'] : '' // strip numbers from job name
      name.jobDisplay = name.firstJob.length < 1 ? '' : `${name.firstJobNoNumbers} ${name.jobsCountDisplay}`
      name.completionIcon = callOut.field_1005 === 'Complete' ? '✔️' : '📆'
      name.street = callOut.field_981.length > 0 ? callOut.field_981_raw.street : ''
      name.city = callOut.field_981.length > 0 ? callOut.field_981_raw.city : ''
      name.address = name.street + ' ' + name.city
      name.addressDisplay = name.address.length < 2 ? '' : '| ' + name.address
      name.installers = getConnectionIdentifiers(callOut.field_927_raw).join(', ')
      name.development = callOut.field_1482.length > 0 ? callOut.field_1482_raw['0'].identifier : ''
      name.nameToDisplay = name.jobsCount > 0 ? name.jobDisplay : name.development

      switch (callOut.field_925) {
        case 'Other':
          name.type = callOut.field_1477 // Custom callout name
          break
        case 'Unavailable/Leave':
          name.typeIcon = '🏄'
          break
        case 'Install':
          name.typeIcon = '🔨'
          break
        case 'Service & Install':
          name.typeIcon = '👷🔨'
          break
        case 'Measure & Install':
          name.typeIcon = '📏🔨'
          break
        case 'Measure':
          name.typeIcon = '📏'
          break
        case 'Service Call':
          name.typeIcon = '👷'
          break
        case 'Drop Off':
        case 'Pick Up':
          name.typeIcon = '🚚'
          break
        default:
          break
      }

      name.formName = `${name.confirmationIcon}${name.typeIcon}${name.type} | ${name.nameToDisplay}`.trim()
      name.calendarName = `${name.formName}${name.addressDisplay}`.trim()
      name.statusTypeInstallers = `${name.confirmationIcon}${name.completionIcon} | ${name.typeIcon}${name.type} (${name.installers})`

      return name
    })
    .then(response => postToConsole(response, 'formatCallOutName ran'))
}

function getInstallerColourIcons(callOut) {
  return Promise.try(() => {
      let installerCount = callOut.field_927_raw === undefined ? 0 : callOut.field_927_raw.length
      let isInstallerUpdated = JSON.stringify(callOut.field_1034) !== JSON.stringify(callOut.field_927)

      if (installerCount > 1) {
        return getRecordsByID('installers', getConnectionIDs(callOut.field_927_raw))
          .then(installers => {
            return installers.reduce(function(colouredHeads, installer) {
              colouredHeads += '<span style="background-color:' + installer.field_1486 + '">👤</span>'
              return colouredHeads
            }, [])
          })
      } else {
        return ''
      }
    })
    .then(response => postToConsole(response, 'getInstallerColourIcons ran'))
}

function getCallOutName(callOut) {
  return Promise.try(() => {
      return Promise.all([formatCallOutName(callOut), getInstallerColourIcons(callOut)])
    })
    .spread(function(name, installerIcons) {
      name.calendarName = installerIcons + name.calendarName
      return name
    })
    .then(response => postToConsole(response, 'getCallOutName ran'))
}

// Gather key callout data with human readable names
function getPrettyCallOut(callOut) {
  return Promise.try(() => {
      let attendees = [callOut.field_1503] // Other Attendees
      if (callOut.field_1476.indexOf('Yes') !== -1) { // User can choose not to email sales & ops
        // Add sales and ops emails to array
        attendees.push(callOut.field_1081)
        attendees.push(callOut.field_1475)
      }
      attendees = attendees.join()

      return {
        'id': callOut.id,
        'fromTime': callOut.field_924_raw.timestamp,
        'toTime': callOut.field_924_raw.to.timestamp,
        'jobs': callOut.field_928.length > 0 ? getConnectionIdentifiers(callOut.field_928_raw).join(', ') : undefined,
        'jobID': callOut.field_928.length > 0 ? callOut.field_928_raw['0'].id : undefined,
        'address': callOut.field_981.replace(/<\/?[^>]+(>|$)/g, ' '), // remove </br> from address string
        'type': callOut.field_925,
        'salesName': callOut.field_985.length > 0 ? callOut.field_985_raw['0'].identifier : undefined,
        'salesEmail': callOut.field_1081,
        'opsName': callOut.field_1474.length > 0 ? callOut.field_1474_raw['0'].identifier : undefined,
        'opsEmail': callOut.field_1475,
        'status': callOut.field_1005,
        'calendarID': callOut.field_1082,
        'installers': callOut.field_927.length > 0 ? getConnectionIdentifiers(callOut.field_927_raw).join(', ') : undefined,
        'attendees': attendees,
        'productToInstall': callOut.field_954.length > 0 ? getConnectionIdentifiers(callOut.field_954_raw).join(', ') : undefined,
        'instructions': callOut.field_929,
        'displayName': callOut.field_1488
      }
    })
    .then(response => postToConsole(response, 'getPrettyCallOut ran'))
}
// Returns a string of emails for the installers associated with a call out
function getInstallerEmailsString(callout) {
  return Promise.try(() => {
      if (callout.field_927.length === 0) {
        throw new Error("Can't get installer emails without installer IDs")
      } else {
        return Promise.try(() => {
            let installerIDs = getConnectionIDs(callout.field_927_raw)
            return getRecordsByID('installers', installerIDs)
          })
          //.then(response => response.json())
          //.then(installers => installers.records)
          .then(installercallOuts => {
            return installercallOuts.reduce((emails, installer) => {
              emails.push(installer.field_870_raw.email)
              return emails
            }, []).join()
          })
      }
    })
    .then(response => postToConsole(response, 'getInstallerEmailsString ran'))
}

function createGoogleEvent(callOut) {
  return Promise.try(() => {
      if (callOut.field_927.length === 0) {
        throw new Error("Can't create an event with no installers")
      } else {
        return Promise.try(() => {
            // let installerIDs = getConnectionIDs(callOut.field_927_raw)
            let promiseArray = [getPrettyCallOut(callOut), getInstallerEmailsString(callOut), updateRecordByID('callouts', callOut.id, { //
              'field_1101': 'Yes', // Flag for update in progress, reset in error handling as well as success
              'field_1496': 'Yes' // Flag for update required, only reset on success
            })]
            return Promise.all(promiseArray)
          })
          .spread(function(prettyCallOut, installerEmails, fullCallOut) {
            prettyCallOut.attendees = prettyCallOut.attendees + ',' + installerEmails
            return manageGoogleEvent('new', prettyCallOut)
          })
          .then(() => {
            return callOut
          })
          .catch((err) => {
            gCalErrorHandler(err, callOut)
          })
      }
    })
    .then(response => postToConsole(response, 'createGoogleEvent ran'))
}

function updateGoogleEvent(callOut) {
  return Promise.try(() => {
      if (callOut.field_927.length === 0) {
        throw new Error("Can't create an event with no installers")
      } else {
        return Promise.try(() => {
            // let installerIDs = getConnectionIDs(callOut.field_927_raw)
            let promiseArray = [getPrettyCallOut(callOut), getInstallerEmailsString(callOut), updateRecordByID('callouts', callOut.id, {
              'field_1496': 'Yes' // Flag for update required, only reset on success
            })]
            return promiseArray
          })
          .then(Promise.all)
          .spread(function(prettyCallOut, installerEmails, fullCallOut) {
            prettyCallOut.attendees = prettyCallOut.attendees + ',' + installerEmails
            return manageGoogleEvent('update', prettyCallOut)
          })
          .then(() => {
            return callOut
          })
      }
    })
    .then(response => postToConsole(response, 'updateGoogleEvent ran'))
}

function deleteGoogleEvent(callout) {
  return Promise.try(() => {
      return manageGoogleEvent('delete', callout)
    })
    .then(() => {
      return callout
    })
    .then(response => postToConsole(response, 'deleteGoogleEvent ran'))
}

function gCalErrorHandler(err, callOut) {
  updateRecordByID('callouts', callOut.id, {
      'field_1101': 'No' // Reset update in progress flag
    })
    .then(() => {
      console.log('error creating event, update in progress flag reset')
      throw err
    })
}

// Add, update or delete an event in google calendar via Zapier
function manageGoogleEvent(updateType, data) {
  return Promise.try(() => {

      let webhookArray = [{
          action: 'new',
          zap: 'xpuj8p',
          message: 'new event created'
        },
        {
          action: 'update',
          zap: 'xnc85h',
          message: 'event updated'
        },
        {
          action: 'delete',
          zap: 'xp4tzz',
          message: 'event deleted'
        }
      ]

      let action = webhookArray.find(zap => {
        return zap.action === updateType
      })

      return sendHookToZapier(action.zap, data, action.message)
    })
    .then(response => postToConsole(response, 'manageGoogleEvent ran'))
}

//***************************************************************************
//******************* ALL FORMS THAT UPDATE CALL OUTS ***********************
//***************************************************************************

//******************* RECORD CREATED ****************************************

// Add call out - job
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/add-a-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_641/views/view_1437
$(document).on('knack-record-create.view_1437', function(event, view, record) {
  processCallOutChanges(record);
});

// Add call out - development
// https://lovelight.knack.com/tracker#developments/view-development-details/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_1024/views/view_2126
$(document).on('knack-record-create.view_2126', function(event, view, record) {
  processCallOutChanges(record);
});

//******************* RECORD UPDATED ****************************************

// Edit Callout
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/edit-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_576/views/view_1294
$(document).on('knack-form-submit.view_1294', function(event, view, record) {
  processCallOutChanges(record);
});

// Review Callout
// https://lovelight.knack.com/tracker#call-outs/review-call-out-details2/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_638/views/view_1426
$(document).on('knack-form-submit.view_1426', function(event, view, record) {
  processCallOutChanges(record);
});

// Cancel Callout
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/cancel-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_690
$(document).on('knack-form-submit.view_1541', function(event, view, record) {
  processCallOutChanges(record);
});


//ReSync Callout
https: //builder.knack.com/lovelight/tracker#pages/scene_950/views/view_1967
  $(document).on('knack-form-submit.view_1967', function(event, view, record) {
    processCallOutChanges(record);
  });

//******************* RECORD DELETED ****************************************

$(document).on('knack-record-delete.view_1215', function(event, view, record) {
  processCallOutChanges(record);
});

//******************* SCHEDULING SCENES LOADED *****************************

//My CallOuts Calendar view for schedulers
$(document).on('knack-scene-render.scene_947', function(event, scene) {
  hideEmptyTables(scene)
});

//Developments page
$(document).on('knack-scene-render.scene_1023', function(event, scene) {
  hideEmptyTables(scene)
});


//VIC Calendar
$(document).on('knack-scene-render.scene_981', function(event, scene) {
  hideEmptyTables(scene)
});

//NSW Calendar
$(document).on('knack-scene-render.scene_982', function(event, scene) {
  hideEmptyTables(scene)
});

//QLD Calendar
$(document).on('knack-scene-render.scene_983', function(event, scene) {
  hideEmptyTables(scene)
});

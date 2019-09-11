// -------------------------------------------------------
// Start Listener
$(document).on('knack-view-render.any', function(event, view, data) {
  let calloutsObj
  // If a view is displaying callouts, add listners
  try {
    if (view.source) {
      if (view.source.object) {
        if (view.source.object === objects.callouts) {
          calloutsObj = new KnackObject(view.source.object, view)
          calloutsObj.onCreate(processNewCallOut)
          calloutsObj.onUpdate(processUpdatedCallOut)
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err)
  }
})
// End Listner

// Force and update when manually resyncing a callout
$(document).on('knack-form-submit.view_1967', function(event, view, record) {
  //forceCalloutUpdate(record)
})

// -------------------------------------------------------
// Start Handlers

// Process newly created callouts
async function processNewCallOut(view, callout, action, fields) {
  try {
    // Set processing flag
    window.callOutProcessing = true

    // Get name of user creating the callout
    let user = Knack.getUserAttributes()
    let createdBy = {}
    createdBy.field_1581 = user.name // created by

    // Gather required updates to the callout callout
    let names = await getCallOutName(callout)
    let jobDetails = await getJobUpdates(callout)
    let updateData = Object.assign({}, createdBy, names, jobDetails)

    // Add 'Calendar update required' flag if required
    if (isEventCreationRequired(callout)) updateData.field_1496 = 'Yes'

    // Update the callout
    let calloutsObj = new KnackObject(objects.callouts)
    callout = await calloutsObj.update(callout.id, updateData)

    handleCalendarUpdates(callout)
    updateConnectedJobsInPortal(callout) // Update any connected portal callouts

  } catch (err) {
    Sentry.captureException(err)
  } finally {
    window.callOutProcessing = false
  }
}

// Process updated callouts
async function processUpdatedCallOut(view, callout, action, fields, previous, changes) {
  try {

    let names = await getCallOutName(callout, changes)
    let jobDetails = await getJobUpdates(callout, changes)
    let reportSubmitter = isReportUpdated(changes) ? {
      'field_1632': Knack.getUserAttributes().name
    } : {}
    let updateData = Object.assign({}, names, jobDetails, reportSubmitter)

    // Add 'Calendar update required' flag if required
    //*** Remove this with calendar migration. The update and result will be availaibe in the same call, no need to set the flag in advance.
    if (isGoogleCalendarActionRequired(callout, previous, changes)) updateData.field_1496 = 'Yes'

    // If there are changes, update the callout
    if (!$.isEmptyObject(updateData)) {
      let calloutsObj = new KnackObject(objects.callouts)
      callout = await calloutsObj.update(callout.id, updateData)
    }

    handleCalendarUpdates(callout, previous, changes)
    handleInstallerReports(callout, previous, changes)

    // Update any connected portal records
    updateConnectedJobsInPortal(callout)

  } catch (err) {
    Sentry.captureException(err)
    throw new Error(err)
  } finally {

  }
}

// Sometime there is a need to force an event update, even when there are no changes
// Requried if there has been an error and the process needs to be run again
async function forceCalloutUpdate(callout) {

  try {
    // If the event needs to be cancelled, do it
    if (isEventCancellationRequired(callout)) return cancelEvent(callout)

    // Otherwise gather data updates
    let names = await getCallOutName(callout, [], true)
    let jobDetails = await getJobUpdates(callout, [], true)
    let updateData = Object.assign({}, names, jobDetails)

    // Apply the updates
    let calloutsObj = new KnackObject(objects.callouts)
    callout = await calloutsObj.update(callout.id, updateData)

    // If there is calendar event created yet, create it
    if (isEventCreationRequired(callout)) return createEvent(callout)

    // Or finally, update the event
    return updateEvent(callout)
  } catch (err) {
    Sentry.captureException(err)
    throw new Error(err)
  }

}

// End Handlers

// -------------------------------------------------------
// Start Calendar Management Functions

// Creates, updates or deletes synced calendar event if required
async function handleCalendarUpdates(callout, previous, changes) {

  let isEventFlagged = callout.field_1101 === 'Yes'
  let isCreate = isEventCreationRequired(callout)
  let isUpdate = isEventUpdateRequired(callout, previous, changes)
  let isCancel = isEventCancellationRequired(callout)

  if (isEventFlagged) return // there's already an update in progress
  if (!(isCreate || isUpdate || isCancel)) return // Exit if we somehow got here when a update is not required

  await applyCalendarUpdateFlag(callout) // Add flag to stop race conditions

  // Get data that describes the event in a human readable way
  let eventData = getCalendarEventData(callout)

  if (isCancel) {
    triggerZap('xp4tzz', eventData)
    cancelEvent(callout)
    return
  }

  // If creating or updating, will need attendees
  eventData.attendees = await getAttendees(callout)

  if (isCreate) {
    triggerZap('xpuj8p', eventData)
    createEvent(callout)
    return
  }

  if (isUpdate) {
    triggerZap('xnc85h', eventData)
    updateEvent(callout)
    return
  }

}

async function createEvent(callout) {
  let calloutObj = new KnackObject(objects.callouts)
  let queryParams = ['sendUpdates=none', 'conferenceDataVersion=1']
  let body = await buildGCalEventBody(callout)
  let params = {
    method: 'POST',
    headers: window.calendarHeaders,
    body: JSON.stringify(body)
  }
  try {
    let gCalEventDetails = await lovelightCalendarService(params, queryParams)
    calloutObj.update(callout.id, {
      'field_1638': gCalEventDetails.id, // remove the event ID
    })
    return gCalEventDetails
  } catch (err) {
    // calloutObj.update(callout.id, {
    //   'field_1496': 'yes', // flag that an update is still required
    // })
    alert(`There was an error creating ${callout.field_1488}.If it continues after a couple of attempts, let Dan know!`)
    throw err
  }
}

async function updateEvent(callout) {
  if (callout.field_1638 <= 1) throw new Error("Can't update event without event Id")
  let calloutObj = new KnackObject(objects.callouts)
  let eventId = callout.field_1638
  let queryParams = ['sendUpdates=none']
  let body = await buildGCalEventBody(callout)
  let params = {
    method: 'PATCH',
    headers: window.calendarHeaders,
    body: JSON.stringify(body)
  }
  try {
    return gCalEventDetails = await lovelightCalendarService(params, queryParams, eventId)
  } catch (err) {
    // calloutObj.update(callout.id, {
    //   'field_1496': 'yes', // flag that an update is still required
    // })
    alert(`There was an error updating ${callout.field_1488}.If it continues after a couple of attempts, let Dan know!`)
    throw err
  }
}

async function cancelEvent(callout) {
  if (callout.field_1638 <= 1) throw new Error("Can't cancel event without event Id")
  let calloutObj = new KnackObject(objects.callouts)
  let eventId = callout.field_1638
  let queryParams = ['sendUpdates=none']
  let body = {
    'status': 'cancelled'
  }
  let params = {
    method: 'PATCH',
    headers: window.calendarHeaders,
    body: JSON.stringify(body)
  }
  try {
    let gCalEventDetails = await lovelightCalendarService(params, queryParams, eventId)
    calloutObj.update(callout.id, {
      'field_1638': '0', // remove the event ID
    })
    return gCalEventDetails
  } catch (err) {
    // calloutObj.update(callout.id, {
    //   'field_1496': 'yes', // flag that an update is still required
    // })
    alert(`There was an error cancelling ${callout.field_1488}.If it continues after a couple of attempts, let Dan know!`)
    throw err
  }
}

async function lovelightCalendarService(params, queryParams, eventId, calendar = 'primary') {
  let url = 'https://wk949u5xcb.execute-api.ap-southeast-2.amazonaws.com/prod/v1/calendar/'
  url += calendar + '/events'
  url += eventId ? '/' + eventId : ''
  url += queryParams ? '?' + queryParams.join('&') : ''

  let response = await fetch(url, params)
  if (!response.ok) throw Error(response.statusText)
  let json = await response.json()
  return json
}

// Applies a calendar flag to a Knack record to prevent race conditions
async function applyCalendarUpdateFlag(callout) {
  let calloutsObj = new KnackObject(objects.callouts)
  let updateData = {}
  updateData.field_1101 = 'Yes' // Add 'Calendar Update In Progress Flag' to avoid race conditions
  await calloutsObj.update(callout.id, updateData)
}

// End Calendar Management Functions

// ----------------------------------------------------------
// Start Helper Functions

// Create the display names for the call out
// Returns a partial callout object with all the necessary fields populated
async function getCallOutName(callout, changes, forceUpdate = false) {

  let nameUpdateField = [
    'field_1485', // callout Type
    'field_1447', // 'Other' Type description
    'field_1633', // Calendar Event Type
    'field_928', // Jobs
    'field_1482', // Development
    'field_981', // Addresss
    'field_927', // Installers
  ]

  // Only continue if there have been report updates
  if (changes || forceUpdate) {
    if (nameUpdateField.filter(field => changes.includes(field)).length === 0) return {}
  }

  let type = callout.field_1485
  let typeIcon = getCalloutTypeIcon(callout)
  let multiInstallerIndicator = await getMultiInstallerIndicator(callout)
  let confirmationIcon = callout.field_1633.indexOf('Confirmed') > -1 ? '' : callout.field_1633.substring(0, 1)

  let jobsCount = callout.field_928.length > 0 ? callout.field_928_raw.length : 0
  let jobsCountDisplay = jobsCount > 1 ? '(+' + (jobsCount - 1) + ' others)' : ''
  let firstJob = jobsCount > 0 ? callout.field_928_raw['0'].identifier : ''
  let firstJobNoNumbers = jobsCount > 0 ? firstJob.split('-').shift().replace(/[0-9]/g, '') + '-' + firstJob.split('-')['1'] : '' // strip numbers from job name
  let jobDisplay = firstJob.length < 1 ? '' : ` | ${firstJobNoNumbers} ${jobsCountDisplay}`

  let development = callout.field_1482.length > 0 ? ' | ' + callout.field_1482_raw['0'].identifier : ''
  let nameToDisplay = jobsCount > 0 ? jobDisplay : development

  let street = callout.field_981.length > 0 ? callout.field_981_raw.street + '' + callout.field_981_raw.street2 : ''
  let city = callout.field_981.length > 0 ? callout.field_981_raw.city : ''
  let address = street + ' ' + city
  let addressDisplay = address.length < 2 ? '' : '| ' + address

  // Build Display Names
  let name = {}
  name.field_1488 = `${confirmationIcon}${typeIcon}${type}${nameToDisplay}`.trim() // Form display name
  name.field_1481 = `${multiInstallerIndicator}${name.field_1488}${addressDisplay}<span id="${callout.id}"><span>`.trim() // Calendar display name
  //The event id has been added in a hidden span at the end to identify the tile for popover population

  return name

}

function getCalloutTypeIcon(callout) {

  let typeOption = callout.field_925

  const typeIcons = [
    ['Unavailable/Leave', '🏄'],
    ['Install', '🔨'],
    ['Service & Install', '👷🔨'],
    ['Measure & Install', '📏🔨'],
    ['Measure', '📏'],
    ['Service Call', '👷'],
    ['Service', '👷'],
    ['Drop Off', '🚚'],
    ['Pick Up', '🚚'],
    ['Load', '💪'],
    ['Christmas', '🎄'],
    ['Drinks', '🍺'],
    ['Party', '🎉'],
    ['Take Down', '👇']
  ]

  // Get type icon
  let icon = typeIcons.reduce((icon, iconPair) => {
    icon += iconPair[0] === typeOption ? iconPair[1] : ''
    return icon
  }, '')

  const otherSearch = ['Take Down', 'Load', 'Party', 'Christmas', 'Drinks', 'Service', 'Measure', 'Install']

  if (typeOption === 'Other') {
    otherSearch.forEach(option => {
      if (callout.field_1477.toLowerCase().indexOf(option.toLowerCase()) > -1) {
        icon += typeIcons.filter(iconPair => iconPair[0] === option)[0][1]
      }
    })
  }

  return icon

}

// Build indicator of multiple installers if this is required
async function getMultiInstallerIndicator(callout) {
  if (!callout.field_927_raw) return ''
  if (callout.field_927_raw.length < 2) return ''
  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await searchRecordsPromise('object_71', installerFilter)
  return installers.reduce(function(colouredHeads, installer) {
    colouredHeads += '<span style="background-color:' + installer.field_1486 + '">👤</span>'
    return colouredHeads
  }, '')
}

// Get all relevant data from job to update callout details
// Returns a partial callout object with all the necgessary fields populated
async function getJobUpdates(callOut, changes, forceUpdate = false) {

  // If changes supplied, return early if no changes to job
  if (changes || forceUpdate) {
    if (!isJobUpdated(changes)) return {}
  }

  // Return early if job is blank
  if (callOut.field_928.length === 0) return {}

  let fieldsToCopy = [
    ['field_1276', 'field_985'], // Salesperson
    ['field_1277', 'field_1474'], // Ops person
    ['field_58', 'field_1494'], // State
    ['field_186', 'field_1482'], // Development
    ['field_59', 'field_1495'], // Busines Unit
  ]

  // Get the job details
  let job = await getRecordPromise(objects.jobs, callOut.field_928_raw[0].id)

  // Preprocess the job data
  job.field_59_raw = (job.field_59 === 'Apartments' || job.field_59 === 'Projects') ? ['Commercial'] : [job.field_59] // we use 'Commercial' for scheulding
  if (job.field_12.length === 0) {
    job.field_12_raw = {}
    job.field_12_raw.street = 'TBA' // address is required field, prevents errors if the job field is blank
  }

  return updateData = copyFieldsToNewObject(job, fieldsToCopy)
}

// Gather key callout data with human readable names
function getCalendarEventData(callout) {
  return {
    'id': callout.id,
    'fromTime': callout.field_924_raw.timestamp,
    'toTime': callout.field_924_raw.to.timestamp,
    'jobs': callout.field_928.length > 0 ? getConnectionIdentifiers(callout.field_928_raw).join(', ') : undefined,
    'address': callout.field_981.replace(/<\/?[^>]+(>|$)/g, ' '), // remove </br> from address string
    'calendarID': callout.field_1082,
    'installers': callout.field_927.length > 0 ? getConnectionIdentifiers(callout.field_927_raw).join(', ') : undefined,
    'productToInstall': callout.field_954.length > 0 ? getConnectionIdentifiers(callout.field_954_raw).join(', ') : undefined,
    'instructions': callout.field_929,
    'displayName': callout.field_1488
  }
}

// Create parameters required to create / update a google calendar event
async function buildGCalEventBody(callout) {
  try {

    let jobs = callout.field_928.length > 0 ? getConnectionIdentifiers(callout.field_928_raw).join('<br>') : ''
    let installers = callout.field_927.length > 0 ? getConnectionIdentifiers(callout.field_927_raw).join('<br>') : ''
    let products = callout.field_954.length > 0 ? getConnectionIdentifiers(callout.field_954_raw).join('<br>') : ''

    let description = `
    <table>
      <tr>
        <td><strong>Jobs(s):</strong></td>
        <td>${jobs}</td>
      </tr>
      <tr>
        <td><strong>Installer(s):</strong></td>
        <td>${installers}</td>
      </tr>
      <tr>
        <td><strong>Product(s):</strong></td>
        <td>${products}</td>
      </tr>
      <tr>
        <td><strong>Instructions:</strong></td>
        <td>${callout.field_929}</td>
      </tr>
      <tr>
        <td><strong>Tracker Link:</strong></td>
        <td><a href="https://lovelight.knack.com/tracker#my-call-outs/call-out-details/${callout.id}">Click Here</a></td>
      </tr>
      <tr>
        <td><strong>Tracker Id:</strong></td>
        <td>|${callout.id}</td>
      </tr>
    </table>
    `

    return {
      'start': {
        'dateTime': moment(callout.field_924_raw.timestamp, 'MM/DD/YYYY hh:m a').toISOString(),
        'timeZone': moment.tz.guess()
      },
      'end': {
        'dateTime': moment(callout.field_924_raw.to.timestamp, 'MM/DD/YYYY hh:m a').toISOString(),
        'timeZone': moment.tz.guess()
      },
      attendees: await getEventAttendees(callout),
      "conferenceData": null,
      'summary': callout.field_1488,
      'description': description,
      'location': callout.field_981.replace(/<\/?[^>]+(>|$)/g, ' '), // remove </br> from address string,
      'source': {
        'url': 'https://lovelight.knack.com/tracker#my-call-outs/call-out-details/' + callout.id,
        'title': 'View Details on Tracker'
      },
    }
  } catch (err) {
    Sentry.captureException(err)
    throw new Error(err)
  }
}

// Returns a comma separated string of email addresses
async function getAttendees(callout) {
  let attendees = []
  attendees = await getInstallerEmails(callout) // adds array of emails
  attendees.push(await getSalesEmail(callout))
  attendees.push(await getOpsEmail(callout))
  attendees.push(await getOtherAttendeeEmails(callout))
  attendees = attendees.join(',').trim()
  if (attendees.replace(/,/g, ',').length === 0) throw new Error("Can't create event without any attendees")
  return attendees
}

// Returns a comma separated string of email addresses
async function getInstallerEmails(callout) {
  let installersObj = new KnackObject(objects.installers)
  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await installersObj.find(installerFilter)
  return installers.map(installer => installer.field_870_raw.email)
}

// Checks for inclusion and salesperson opt out
// Returns an email address
// ignorePrefs defaults to false, when true send email even if opted out
async function getSalesEmail(callout, ignorePrefs = false) {
  if (!callout.field_985_raw || !callout.field_985_raw[0]) return // there is no salesperson on the callout
  if (!ignorePrefs && callout.field_1476.indexOf('Yes') === -1) return '' // we're not emailing them
  let salespeopleObj = new KnackObject(objects.salespeople)
  let salesperson = await salespeopleObj.get(callout.field_985_raw[0].id)
  if (!ignorePrefs && salesperson.field_1596 === 'Yes') return '' // they've opted out of event emails
  if (salesperson.field_957_raw) return salesperson.field_957_raw.email
  return undefined
}

// Checks for inclusion and opsperson opt out
// Returns an email address
// ignorePrefs defaults to false, when true send email even if opted out
async function getOpsEmail(callout, ignorePrefs) {
  if (!callout.field_1474_raw || !callout.field_1474_raw[0]) return // there is no ops on the callout
  if (!ignorePrefs && callout.field_1476.indexOf('Yes') === -1) return '' // we're not emailing them
  let opspeopleObj = new KnackObject(objects.opspeople)
  let opsperson = await opspeopleObj.get(callout.field_1474_raw[0].id)
  if (!ignorePrefs && opsperson.field_1597 === 'Yes') return '' // they've opted out of event emails
  if (opsperson.field_814_raw) return opsperson.field_814_raw.email
  return undefined
}

// Returns a comma separated string of email addresses
function getOtherAttendeeEmails(callout) {
  return callout.field_1503.replace(/;/g, ',').replace(/ /g, ',')
}

// NEW FUNCTIONS

// Returns an array of receipient objects
async function getEventAttendees(callout) {

  let params = {
    'callout': callout
  }

  let installers = await getInstallerRecipients(params)
  let sales = await getSalesRecipients(params)
  let ops = await getOpsRecipients(params)
  let other = await getOtherAttendeeRecipients(params)

  let attendees = [].concat(installers, sales, ops, other)
  if (attendees.length === 0) throw new Error("Can't create event without any attendees")
  return attendees
}

// Returns an array of receipient objects
// If ignorePrefs is true will return the email even if opted out
async function getSalesRecipients({
  callout,
  optional = true,
  ignorePrefs = false
}) {

  if (!callout.field_985_raw || !callout.field_985_raw[0]) return [] // there is no salesperson on the callout
  if (!ignorePrefs && callout.field_1476.indexOf('Yes') === -1) return [] // scheduler has opted not to email them
  let salespeopleObj = new KnackObject(objects.salespeople)
  let salesperson = await salespeopleObj.get(callout.field_985_raw[0].id)
  if (!ignorePrefs && salesperson.field_1596 === 'Yes') return [] // they've opted out of event emails

  if (salesperson.field_957_raw) {

    let recipient = {
      'email': salesperson.field_957_raw.email,
      'name': callout.field_985_raw[0].identifier,
    }

    if (optional) recipient.optional = true // Add optional property

    return [recipient]
  }
  return []
}

// Returns an array of receipient objects
// If ignorePrefs is true will return the email even if opted out
async function getOpsRecipients({
  callout,
  optional = true,
  ignorePrefs = false
}) {

  if (!callout.field_1474_raw || !callout.field_1474_raw[0]) return [] // there is no ops on the callout
  if (!ignorePrefs && callout.field_1476.indexOf('Yes') === -1) return [] // scheduler has opted not to email them
  let opspeopleObj = new KnackObject(objects.opspeople)
  let opsperson = await opspeopleObj.get(callout.field_1474_raw[0].id)
  if (!ignorePrefs && opsperson.field_1597 === 'Yes') return [] // they've opted out of event emails

  if (opsperson.field_814_raw) {

    let recipient = {
      'email': opsperson.field_814_raw.email,
      'name': callout.field_1474_raw[0].identifier,
    }

    if (optional) recipient.optional = true // Add optional property

    return [recipient]
  }
  return []
}

// Returns an array of receipient objects
async function getInstallerRecipients({
  callout
}) {
  let installersObj = new KnackObject(objects.installers)
  let installerIDs = getConnectionIDs(callout.field_927_raw)
  let installerFilter = createFilterFromArrayOfIDs(installerIDs)
  let installers = await installersObj.find(installerFilter)
  return installers.map(installer => {
    return {
      'email': installer.field_870_raw.email,
      'name': installer.field_869
    }
  })
}

// Returns an array of receipient object
function getOtherAttendeeRecipients({
  callout
}) {
  if (callout.field_1503 === '') return []
  let attendees = callout.field_1503.split(',')
  return attendees.map(email => {
    return {
      'email': email
    }
  })
}

// End Helper Functions

// ----------------------------------------------------------
// Start Boolean Helper Functions

function isGoogleCalendarActionRequired(callout, previous, changes) {
  if (callout.field_1101 === 'Yes') return false // there's already an update in progress
  if (isEventCreationRequired(callout) || isEventCancellationRequired(callout) || isEventUpdateRequired(callout, previous, changes)) return true
  return false
}

function isEventCreationRequired(callout) {
  if (callout.field_1082.length > 1) return false // if it's already in the calendar, don't create
  if (!isEventTypeInviteable(callout)) return false // if not an invitable type, no need to create
  if (isCalloutStatusInviteable(callout)) {
    console.log('isEventCreationRequired = true')
    return true
  } // given above two checks, if invitable status, create required
  return false // else return false
}

function isEventCancellationRequired(callout) {
  if (callout.field_1082.length <= 1) return false // if it's not in the calendar, no need to delete
  if (!isEventTypeInviteable(callout) || !isCalloutStatusInviteable(callout)) {
    // if it's not an inviteable type, need to delete it
    // if it's not an inviteable status, need to delete it
    console.log('isEventCancellationRequired = true')
    return true
  }
  return false // else return false
}

function isEventUpdateRequired(callout, previous, changes) {
  if (isEventCreationRequired(callout) || isEventCancellationRequired(callout)) return false // don't update if creating or deleting
  if (callout.field_1082.length <= 1) return false // if it's not in the calendar, no need to udpate
  if (isEventDataUpdated(callout, previous, changes)) {
    console.log('isEventUpdateRequired = true')
    return true
  } // if data the impacts the event is changed, need to update it
  return false // else return false
}

function isEventTypeInviteable(callout) {
  let inviteableTypes = ['✔️ Confirmed', '❔ Tentative - but still send invites']
  if (inviteableTypes.includes(callout.field_1633)) return true
  return false
}

function isCalloutStatusInviteable(callout) {
  let inviteableStatuses = ['Scheduled', 'Tentative']
  if (inviteableStatuses.includes(callout.field_1005)) return true
  return false
}

function isEventDataUpdated(callout, previous, changes) {
  if (isJobUpdated(changes)) return true
  if (isScheduledDateUpdated(changes)) return true
  if (isAddressUpdated(changes)) return true
  if (isTypeUpdated(changes)) return true
  if (isInstallerUpdated(changes)) return true
  if (isOtherAttendeesUpdated(changes)) return true
  if (isSalesUpdated(callout, previous, changes)) return true
  if (isOpsUpdated(callout, previous, changes)) return true
  return false
}

function isJobUpdated(changes) {
  if (changes.includes('field_928')) return true
  return false
}

function isScheduledDateUpdated(changes) {
  if (changes.includes('field_924')) return true
  return false
}

function isAddressUpdated(changes) {
  if (changes.includes('field_981')) return true
  return false
}

function isTypeUpdated(changes) {
  if (changes.includes('field_1485')) return true
  return false
}

function isInstallerUpdated(changes) {
  if (changes.includes('field_927')) return true
  return false
}

function isOtherAttendeesUpdated(changes) {
  if (changes.includes('field_1503')) return true
  return false
}

function isSalesUpdated(callout, previous, changes) {
  if (changes.includes('field_1476')) { // if include sales toggle has changed
    if (callout.field_985.length > 0 || previous.field_985.length > 0) return true // return true if there is (or was) a sales person
  }
  if (changes.includes('field_985')) { // given include toggle hasn't changed, if salesperson is updated
    if (callout.field_1476.indexOf('Yes') > -1) return true // return true if they are to be included
  }
  return false
}

function isOpsUpdated(callout, previous, changes) {
  if (changes.includes('field_1476')) { // if include sales toggle has changed
    if (callout.field_1474.length > 0 || previous.field_1474.length > 0) return true // return true if there is (or was) a sales person
  }
  if (changes.includes('field_1474')) { // given include toggle hasn't changed, if salesperson is updated
    if (callout.field_1476.indexOf('Yes') > -1) return true // return true if they are to be included
  }
  return false
}

function isReportUpdated(changes) {

  let installerReportFields = [
    'field_1542', // Outcome
    'field_1547', // What went wrong?
    'field_1545', // Report details
    'field_1548', // Photos uploaded?
    'field_1549', // Docs uploaded?
    'field_1626', // Consumables supplied?
    'field_1627', // What was supplied?
    'field_1616', // Estimated install time
  ]

  // Only continue if there have been report updates
  if (installerReportFields.filter(field => changes.includes(field)).length > 0) return true
  return false
}

// End Boolean Helper Functions

// ----------------------------------------------------------
// Start Related Functions

// Update commercial jobs connected to callouts if callout is Install or Measure
function updateConnectedJobsInPortal(record) {

  const portalToTrackerMap = [
    //portal status name, callout type name,
    ['measure_booked', 'Measure'],
    ['install_booked', 'Install']
  ]

  if (record.field_1635 === 'No') return // record wasn't created by the portal

  let isConnectedToJob = record.field_928.length > 0
  let isConfirmed = record.field_1005 !== 'Tentative'
  let isCommercial = record.field_1495.indexOf('Commercial') > -1
  let isCancelled = record.field_1005 === 'Cancelled'

  // Exit early if there is no job or the callout is tentative or it's not a commercial job
  if (!(isConnectedToJob && isConfirmed && isCommercial) || isCancelled) {
    return
  }

  let callOutType = record.field_925
  let changeDetails = portalToTrackerMap.filter((type) => type[1] === callOutType)[0]
  // Proceed if the callout type is measure or an install
  if (changeDetails !== undefined) {
    record.field_928_raw.forEach(job => {
      let measureDate = changeDetails[1] = 'Measure' ? record.field_939 : ''
      let installDate = changeDetails[1] = 'Install' ? record.field_939 : ''
      changeStatusInPortal(job.id, changeDetails[0], measureDate, installDate)
    })
  }
}

async function handleInstallerReports(callout, previous, changes) {

  let TEMPLATE_ID = 'd-0b432fc139d846d7a5b237dc975c4360'

  if (!isReportUpdated(changes)) return
  let dynamic_template_data = await generateReportTemplateData(callout, previous)
  let email_body = await generateReportEmailBody(callout, dynamic_template_data, TEMPLATE_ID)
  triggerZap('o3azzbk', email_body) // Because of CORS have to send via Zapier
  return

}

async function generateReportTemplateData(callout, previous){

    let dynamicData = {}

    let isFirstReport = previous.field_1546 === 'Pending'
    let calloutType = callout.field_925
    let division = callout.field_1495 // Customer, Commercial, Volume

    let outcome = callout.field_1542 // No Issues, Follow Up Required
    let calloutName = callout.field_1488
    let jobs = callout.field_928.length > 0 ? getConnectionIdentifiers(callout.field_928_raw).join('<br>') : undefined
    let installers = callout.field_927.length > 0 ? getConnectionIdentifiers(callout.field_927_raw).join('<br>') : ''
    let products = callout.field_954.length > 0 ? getConnectionIdentifiers(callout.field_954_raw).join('<br>') : ''
    let whatWentWrong = callout.field_1547
    let reportDetails = callout.field_1545
    let installTimeRequired = callout.field_1616
    let photosUploaded = callout.field_1548 // Yes, No
    let docsUploaded = callout.field_1549
    let serviceCallIssue = callout.field_1582
    let serviceChargeable = callout.field_1579 // Yes, No
    let notChargeableReason = callout.field_1623 === 'Other' ? callout.field_1624 : callout.field_1623
    let consumablesSupplied = callout.field_1626 // Yes, No
    let consumableDetails = callout.field_1627

    let instructions = callout.field_929

    dynamicData.id = callout.id
    dynamicData.updatePrefix = isFirstReport ? '' : 'UPDATED'
    dynamicData.outcome = outcome
    dynamicData.calloutName = calloutName

    let calloutDetailRows = []

    // Callout Job Details
    if(jobs) calloutDetailRows.push({
      'label': callout.field_928_raw && callout.field_928_raw.length > 1 ? 'Jobs' : 'Job',
      'details': jobs
    })

    // Installer Details
    calloutDetailRows.push({
      'label':callout.field_927_raw && callout.field_927_raw.length > 1 ? 'Installers' : 'Installer',
      'details': installers
    })

    // Service Call Details
    if(calloutType === 'Service Call') {

      // Reason for Service call
      calloutDetailRows.push({
        'label':'Service Call Reason',
        'details': serviceCallIssue
      })
      // Chargeable?
      calloutDetailRows.push({
        'label':'Chargeable?',
        'details': serviceChargeable === 'Yes' ? 'Yes' : `No. ${notChargeableReason}`
      })

    }

    // Products
    if(callout.field_954_raw && callout.field_954_raw.length > 0) calloutDetailRows.push({
      'label':'Products',
      'details': callout.field_954_raw.length <= 10 ? products : 'Many'
    })

    // Installer's instructions
    calloutDetailRows.push({
      'label':'Instructions',
      'details': instructions
    })

    let calloutOutcomeRows = []

    // Issues
    if(outcome.indexOf('Follow')>-1) calloutOutcomeRows.push({
      'label':'What went wrong',
      'details': whatWentWrong
    })

    // Installer's report
    calloutOutcomeRows.push({
      'label':'Details',
      'details': reportDetails
    })

    // Service Call Details
    if(calloutType === 'Service Call') calloutOutcomeRows.push({
        'label':'Consumables Supplied',
        'details': consumablesSupplied === 'Yes' ? consumableDetails : `None`
      })

    // Estimate Install Time
    if(installTimeRequired.length > 0) calloutOutcomeRows.push({
      'label':'Estimated Install Time',
      'details': installTimeRequired
    })

    // Docs & Photos
    calloutOutcomeRows.push({
      'label':'Photos or docs?',
      'details': `Photos: ${photosUploaded}, Docs: ${docsUploaded}`
    })


    dynamicData.details = `
    <table>
    <tr><td colspan="2"><strong><u>${calloutType}</u></strong></td></tr>
    <tr><td colspan="2">&nbsp;</td></tr>
    ${calloutDetailRows.map(row => `<tr><td style="padding:5px;" class="row-label"><strong>${row.label}</strong></td><td style="padding:5px;">${row.details}</td></tr>`).join('')}
    <tr><td colspan="2">&nbsp;</td></tr>
    <tr><td colspan="2" style="padding: 0px 0px 2px" bgcolor="#000000"></td></tr>
    <tr><td colspan="2">&nbsp;</td></tr>
    <tr><td colspan="2"><strong><u>Report</u></strong></td></tr>
    <tr><td colspan="2">&nbsp;</td></tr>
    ${calloutOutcomeRows.map(row => `<tr><td style="padding:5px;"><strong>${row.label}</strong></td><td style="padding:5px;">${row.details}</td></tr>`).join('')}
    </table>`

    return dynamicData

}

async function generateReportEmailBody(callout, dynamic_template_data, template_id) {

  let user = Knack.getUserAttributes()
  let installers = await getInstallerRecipients({callout:callout})
  let sales = await getSalesRecipients({callout:callout, optional:false, ignorePrefs:true})
  let ops = await getOpsRecipients({callout:callout, optional:false, ignorePrefs:true})
  let reports = [{'email':'reports@lovelight.com.au'}]

  // Gather data for email.
  //https://sendgrid.com/docs/API_Reference/api_v3.html
  let from = {
    'email': 'reports@lovelight.com.au',
    'name': user.name
  }
  let reply_to = {
    'email': user.email,
    'name': user.name
  }
  let to = [{'email':'dan@lovelight.com.au'}] // sales
  console.log(sales)
  let cc = [].concat(installers,ops,reports)
  console.log(cc)

  return body = {
    'personalizations': [{
      'to':to,
      //'cc':cc,
      'dynamic_template_data':dynamic_template_data,
    }],
    'from':from,
    'reply_to':reply_to,
    'template_id':template_id
  }

}

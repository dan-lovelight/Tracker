function processLeadChange({record:lead, changes, action, view, previous}) {
  try {

    let statusUpdates = getLeadStatusChangeDetails(lead, changes)
    let newRecord = action.isCreate ? {'field_1716':Knack.getUserAttributes().name } : {}

    // Consolidate the data
    let updateData = Object.assign({}, statusUpdates, newRecord)

    // Update the lead
    if (!$.isEmptyObject(updateData)) {
      let leadObj = new KnackObject(objects.leads)
      leadObj.update(lead.id, updateData)
    }

    handleLeadNotes(lead, action.isCreate, view, previous, changes)
    //handleSlackNotifications(opportunity, changes, previous, action)

  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
}

function getLeadStatusChangeDetails(lead, changes){
  let data = {}
  let isStatusUpdated = isLeadStatusUpdated(changes)

  if (isStatusUpdated) {
    data.field_1697 = {
      "date": moment().format("DD/MM/YYYY"),
    }

    if (lead.field_973 === 'Dead'){
      // Record the closed date
      data.field_1698 = moment().format("DD/MM/YYYY h:mm a");
    } else {
      data.field_1698 = ''
    }

  }

  return data

}

function isLeadStatusUpdated(changes) {
  if (changes.includes('field_1705')) return true
  return false
}

function hasPrimaryContact(lead) {
  if (lead.field_1670.length > 0) return true
  return false
}

function handleLeadNotes(lead, isNewLead, view, previous, changes) {
  try {
    let user = Knack.getUserAttributes()
    let isStatusUpdated = isLeadStatusUpdated(changes)
    //let hasContact = hasPrimaryContact(lead)
    let notes = []
    let data = {}

    data.field_1655 = user.name // Create by
    data.field_1692 = [lead.id] // Link to lead
    //data.field_1679 = hasContact ? [lead.field_1670_raw.id] :[] // Link to contact

    if (isNewLead) {
      // Insert lead created record
      data.field_1659 = ['5de041bdda511100150e07b8'] // Lead Created
      data.field_576 = `${lead.field_1705_raw.identifier} lead "${lead.field_948}" created from ${view.name} form`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isStatusUpdated && !isNewLead) {
      let status = lead.field_1705_raw[0].identifier

      if (status.indexOf('Converted') > -1) {
        // Insert a lead completed record
        data.field_1659 = ['5de0422a11d759001575f44f'] // Lead Conveted
        data.field_576 = `Lead converted from ${previous.field_1705_raw[0].identifier} to an Opportunity!}`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else if (status.indexOf('Dead') > -1) {
        // Insert a lead cancelled record
        data.field_1659 = ['5de04200da511100150e07d1'] // Lead Dead
        data.field_576 = `Status changed from ${previous.field_1705_raw[0].identifier} to ${status}`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else if (status.indexOf('Cold') > -1){
        // Insert a status change record
        data.field_1659 = ['5de042f54546590015b8d463'] // Status Change to Cold
        data.field_576 = `Status changed from ${previous.field_1705_raw[0].identifier} to ${status}`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else if (status.indexOf('Warm') > -1){
        // Insert a status change record
        data.field_1659 = ['5de0428e2ce6140019b63df5'] // Status Change to Warm
        data.field_576 = `Status changed from ${previous.field_1705_raw[0].identifier} to ${status}`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else if (status.indexOf('Hot') > -1){
        // Insert a status change record
        data.field_1659 = ['5de042a5faf6780015e6dc6f'] // Status Change to Hot
        data.field_576 = `Status changed from ${previous.field_1705_raw[0].identifier} to ${status}`
        notes.push(JSON.parse(JSON.stringify(data)))
      }
    }

    // Insert the notes if there are any
    if (notes.length > 0) addActivityRecords(notes)
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}

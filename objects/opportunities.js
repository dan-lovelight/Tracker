function processOpportunityChange({record:opportunity, changes, action, view, previous}) {
  try {

    let statusUpdates = getOppStatusChangeDetails(opportunity, changes)
    let noteUpdates = getOppNoteUdpates(opportunity)

    // Consolidate the data
    let updateData = Object.assign({}, statusUpdates, noteUpdates)

    // Update the opportunity
    if (!$.isEmptyObject(updateData)) {
      let opportunityObj = new KnackObject(objects.opportunities)
      opportunityObj.update(opportunity.id, updateData)
    }

    handleOppNotes(opportunity, action.isCreate, view, previous, changes)
    handleSlackNotifications(opportunity, changes, previous, action)

  } catch (err) {
    Sentry.captureException(err)
  }
}

function getOppStatusChangeDetails(opportunity, changes){
  let data = {}
  let isStatusUpdated = isOppStatusUpdated(changes)
  let isQuoteStatusUpdated = changes.includes('field_1606')
  // Record the status change date
  if (isStatusUpdated) {
    data.field_1609 = {
      "date": moment().format("DD/MM/YYYY"),
    }
    // Has status become 'To Quote'?
    if (opportunity.field_127 === "To Quote") {
      // User can set quote status during transition from Pending Review back to Quote
      data.field_1606 = "Open" // Set the 'Quote Status' to Open
    }

    if (opportunity.field_127 === 'Won'){
      // Record the won date
      data.field_132 = moment().format("DD/MM/YYYY h:mm a");
    }

  }
  // Record the date the quoted status changed (eg Open/Pending)
  if (isQuoteStatusUpdated) {
    data.field_1610 = {
      "date": moment().format("DD/MM/YYYY"),
    }
  }

  return data

}

function getOppNoteUdpates(opportunity){
  let data = {}
  // Process notes if these have been added
  if (isOppNoteAdded(opportunity)){
    data.field_126 = opportunity.field_1665 //copy this note to the last note field
    data.field_1665 = '' // clear the note
  }
  return data
}

function handleSlackNotifications(opportunity, changes, previous, action){

  // Trigger zap for new quote requests (create's ticket in ZD)
  if(action.isCreate && opportunity.field_127==='To Quote') triggerZap('lq798w', opportunity, 'new quote request')

  // Only continue if status is updated
  if(!isOppStatusUpdated(changes)) return

  //Set variables
  const QUOTE_NOTIFICATION_VALUE = 50000;
  const SALE_NOTIFICATION_VALUE = 10000;

  let value = opportunity.field_128.length > 0 ? parseInt(opportunity.field_128_raw.replace(/\,/g, '')) : undefined;
  let salesPerson = opportunity.field_1274.length > 0 ? opportunity.field_1274_raw["0"].identifier : undefined;
  let quotedBy = opportunity.field_1275.length > 0 ? opportunity.field_1275_raw["0"].identifier : salesPerson;

  let data = {
    status:opportunity.field_127,
    opportunity:opportunity.field_123_raw,
    value:value,
    value_formatted:opportunity.field_128_raw ? opportunity.field_128_raw.split(".")[0] : value,
    salesPerson:salesPerson,
    quotedBy:quotedBy,
    company:opportunity.field_1460.length > 0 ? opportunity.field_1460_raw["0"].identifier : undefined,
    salesPersonCredit: `${salesPerson} & ${quotedBy}`
  }

  // Has just changed to open
  if(opportunity.field_127 === 'Open') {
    // Was previously being quoted
    if(previous.field_127 === 'To Quote' || previous.field_127 === 'Pending Review'){
      //Meets our quote notification criteria
      if(value >= QUOTE_NOTIFICATION_VALUE && typeof quotedBy !== 'undefined'){
        // Send quote notification
        triggerZap('l5tgdk', data, 'Quote!')
      }
    }
  }

  // Has just changed to won
  if(opportunity.field_127 === 'Won') {

    //Meets our sale notification criteria
    if(value >= SALE_NOTIFICATION_VALUE && typeof salesPerson !== 'undefined'){

      // Jem doesn't want any credit...
      if(salesPerson.indexOf('Jeremy') > -1) data.salesPersonCredit = quotedBy

      // Send sale notification
      triggerZap('l5tx9j', zapierData, 'Sale!')

    }

    //Notify QLD channel about all wins
    if (record.field_117 == 'QLD' && value < SALE_NOTIFICATION_VALUE) {
      data.salesPersonCredit = salesPerson;
      triggerZap('e337ri', zapierData, 'QLD Sale!');
    }

    // Send notification of B2B sales
    if (typeof company !== 'undefined') triggerZap('l5hoyo', zapierData, 'Opportunity has a company');

  }

}

function handleOppNotes(opportunity, isNewOpp, view, previous, changes) {
  try {
    let user = Knack.getUserAttributes()
    let isThereANote = isOppNoteAdded(opportunity)
    let isStatusUpdated = isOppStatusUpdated(changes)
    let isValueUpdated = isOppValueUpdated(changes)
    let notes = []
    let data = {}

    data.field_1655 = user.name // Create by
    data.field_1663 = [opportunity.id]

    if (isNewOpp) {
      // Insert opportunity created record
      data.field_1659 = ['5d95285fd76c0c0010a707d3'] // Opp Created
      data.field_576 = `Opportunity created from ${view.name} form`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isThereANote) {
      // Insert a note record
      data.field_1659 = ['5d8c078bdb00f0001095e39d'] // Note
      data.field_576 = opportunity.field_1665 // Note details
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (isStatusUpdated) {

      if(opportunity.field_127 === 'Won' || opportunity.field_127 === 'Won as SWP'){

        data.field_1659 = ['5d9528dad76c0c0010a70955'] // Opportunity Won
        data.field_576 = `Opportunity Won! ${opportunity.field_139} days from quote to close.`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else if(opportunity.field_127 === 'Lost'){

        data.field_1659 = ['5d9528bfe83dee00109dd2bd'] // Opportunity Lost
        data.field_576 = `Opportunity Lost. ${opportunity.field_139} days from quote to close.`
        notes.push(JSON.parse(JSON.stringify(data)))

      } else {
          // Insert a status change record
          data.field_1659 = ['5d8c0d5622d07d0010b41b9e'] // Status Change
          data.field_576 = `Status changed from ${previous.field_127} to ${opportunity.field_127}`
          notes.push(JSON.parse(JSON.stringify(data)))
      }

    }

    if (isValueUpdated) {
      // Insert a value change record
      data.field_1659 = ['5d8c0e42ca31bf0010deb365'] // Value Change
      data.field_887 = 'Value Changed' // Delete this field once migration is complete
      data.field_576 = `Opportunity value changed from ${previous.field_128} to ${opportunity.field_128}`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    // Insert the notes if there are any
    if (notes.length > 0) addActivityRecords(notes)
  } catch (err) {
    Sentry.captureException(err)
  }

}

function isOppStatusUpdated(changes) {
  if (changes.includes('field_127')) return true
  return false
}

function isOppValueUpdated(changes) {
  if (changes.includes('field_128')) return true
  return false
}

function isOppNoteAdded(opportunity) {
  if (opportunity.field_1665.length > 0) return true
  return false
}

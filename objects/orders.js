async function processOrderChange({
  record: order,
  action,
  changes,
  previous
}) {

  try {
    // Get data to update the order
    let statusUpdates = getOrderStatusUpdates(order, previous, changes)
    let stocktakeUpdates = getOrderStocktakeUpdates(order)

    // Consolidate the data
    let updateData = Object.assign({}, statusUpdates, stocktakeUpdates)

    // Update the job
    if (!$.isEmptyObject(updateData)) {
      let ordersObj = new KnackObject(objects.orders)
      order = await ordersObj.update(order.id, updateData)
    }

    // These downstream actions use the updated order object
    // Important as the status may have changed (eg bay entered)
    handleOrderNotifications(order, previous, changes)
    handleOrderPortalStatusChange(order, previous, changes)
    handleOrderNotes(order, previous, changes, action)

  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}

function isOrderStatusUpdated(changes) {
  if (changes.includes('field_442')) return true
  return false
}

function isOrderStatusOrdered(order) {
  if (order.field_442_raw && order.field_442_raw[0].identifier.includes("Ordered")) return true
  return false
}

function isOrderStatusWarehouse(order) {
  if (order.field_442_raw && order.field_442_raw[0].identifier.includes("In Warehouse")) return true
  return false
}

function isOrderStockTakeToday(order) {
  let today = moment().format("DD/MM/YYYY")
  if (order.field_1001.length > 0 && order.field_1001_raw.date_formatted === today) return true
  return false
}

function isOrderBayJustEntered(changes, previous) {
  if (changes.includes('field_90') && previous.field_90.length === 0) return true
  return false
}

function isOrderJustReceived(order, previous, changes) {
  let isStatusUpdated = isOrderStatusUpdated(changes)
  let isInWarehouse = isOrderStatusWarehouse(order)
  let isOrdered = isOrderStatusOrdered(order)
  let isBayJustEntered = isOrderBayJustEntered(changes, previous)
  if (isStatusUpdated && isInWarehouse) return true
  if (isBayJustEntered && isOrdered) return true
  return false
}

function getOrderStatusUpdates(order, previous, changes) {
  let data = {}

  let isStatusUpdated = isOrderStatusUpdated(changes)
  let isJustReceived = isOrderJustReceived(order, previous, changes)
  let isBayJustEntered = isOrderBayJustEntered(changes, previous)
  let isOrdered = isOrderStatusOrdered(order)

  // Update dates of status change and order received
  if (isStatusUpdated) data.field_264 = moment().format("DD/MM/YYYY hh:mma")
  if (isJustReceived) data.field_22 = moment().format("DD/MM/YYYY")

  // If ordered status but just got a bay, update to in warehouse status
  if (isOrdered && isBayJustEntered) data.field_442 = ['59086d0d86d2272d7a9805db']

  return data
}

function getOrderStocktakeUpdates(order) {
  let data = {}
  let isStockTakeToday = isOrderStockTakeToday(order)
  if (isStockTakeToday) data.field_1000 = order.field_90_raw
  return data
}

function handleOrderPortalStatusChange(order, previous, changes) {

  let isJustReceived = isOrderJustReceived(order, previous, changes)

  if (!isJustReceived) return
  if (!order.field_591 === 'Apartments') return

  let portalData = {
    jobId: order.field_10_raw[0].id,
    newPortalState: 'order_received',
    date: ''
  }

  changeStatusInPortal(portalData)
}

async function handleOrderNotifications(order, previous, changes) {

  let isJustReceived = isOrderJustReceived(order, previous, changes)
  if (!isJustReceived) return

  let zapData = {}

  zapData.orderID = order.id;
  zapData.jobID = order.field_10_raw["0"].id;
  zapData.bays = order.field_90.length > 0 ? getConnectionIdentifiers(order.field_90_raw) : ''
  zapData.supplier = order.field_1446_raw["0"].identifier;
  zapData.quantity = order.field_17;
  zapData.product = order.field_11_raw["0"].identifier;
  zapData.deliveryLocation = order.field_111;
  zapData.notes = order.field_18;
  zapData.status = status;

  let jobsObj = new KnackObject(objects.jobs)
  let job = await jobsObj.get(order.field_10_raw[0].id)

  zapData.jobStatus = job.field_245_raw[0].identifier
  zapData.jobName = job.field_296

  // Get salesperson details
  if (job.field_1276.length > 0) {
    let salesObj = new KnackObject(objects.salespeople)
    let salesperson = await salesObj.get(job.field_1276_raw[0].id)
    zapData.salesEmail = salesperson.field_957_raw.email
  }

  // Get salesperson details
  if (job.field_1277.length > 0) {
    let opsObj = new KnackObject(objects.opspeople)
    let opsperson = await opsObj.get(job.field_1277_raw[0].id)
    zapData.opsEmail = opsperson.field_814_raw.email
  }

  // Send email to salesperson
  triggerZap('eak2n4', zapData, 'order received notification sent');
}

function handleOrderNotes(order, previous, changes, action){
  try {
    let user = Knack.getUserAttributes()
    let isOrderReceived = isOrderJustReceived(order, previous, changes, action)
    let notes = []
    let data = {}

    data.field_1655 = user.name // Created by
    data.field_579 = [order.field_10_raw[0].id]

    if (isOrderReceived) {
      // Insert job created record
      data.field_1659 = ['5d8c26b5cb58ff00136ee634'] // Order received
      let receivedInfo = ''
      if(order.field_90_raw) {
        receivedInfo = `received into bay ${order.field_90_raw.map(bay => bay.identifier).join(', ')}`
      } else {
        receivedInfo = 'received'
      }
      data.field_576 = `${order.field_17} ${order.field_1446_raw[0].identifier} ${order.field_11_raw[0].identifier} ${receivedInfo}`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    if (action.isCreate) {
      // Insert order created record
      data.field_1659 = ['5d8c268e171d2c0011558768'] // Order created
      data.field_576 = `New order sent to ${order.field_1446_raw[0].identifier}: ${order.field_17} ${order.field_11_raw[0].identifier}`
      notes.push(JSON.parse(JSON.stringify(data)))
    }

    // Insert the notes if there are any
    if (notes.length > 0) addActivityRecords(notes)

  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

}

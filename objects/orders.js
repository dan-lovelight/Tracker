const orderEvents = [
  'knack-record-create.view_1139', //Add estimate
  'knack-record-create.view_96', //Add order
  'knack-record-create.view_1019', //Record Stock Usage
  'knack-record-create.view_1000', //Create Related Order
  'knack-form-submit.view_1140', //Edit Estimate
  'knack-form-submit.view_223', //Edit Order
  'knack-form-submit.view_997', //Change Order Status
  'knack-form-submit.view_1333', //Update Storage Bay
  'knack-form-submit.view_1334', //Update Carton Number
  'knack-form-submit.view_1353', //Warehouse Change Order Status
  'knack-cell-update.view_97', //Job details table
  'knack-cell-update.view_1087', //Search Orders
  'knack-cell-update.view_998', //Related orders table in order details
  'knack-cell-update.view_1287', //Stocktake table
  'knack-cell-update.view_1332', //Deliver manifest table
  'knack-cell-update.view_1335', //Recently received table
]

// Order is updated
$(document).on(orderEvents.join(' '), function(event, view, record) {
  processOrderChanges(record);
});

async function processOrderChanges(record) {

  let trackStatusChange = [
    ['field_442', 'field_443']
  ]

  let status = record.field_442_raw["0"].identifier

  // Sometimes an order's bay is entered without the status being updated
  // This looks for these instances and updates the status to 'In Warehouse'
  // Placing this before the status change check triggers downstream updates
  if (status.includes("Ordered") && record.field_90.length > 0) record.field_442 = ['59086d0d86d2272d7a9805db']

  let today = moment().format("DD/MM/YYYY")
  let now = moment().format("DD/MM/YYYY hh:mma")
  let isStatusUpdated = isObjectUpdated(record, trackStatusChange)
  let isJustReceived = isStatusUpdated && status.indexOf('Warehouse') > -1
  let isStockTakeToday = record.field_1001.length > 0 && record.field_1001_raw.date_formatted === today

  // Gather data for the updated order
  let updatedOrder = {}

  if (isStatusUpdated) {
    updatedOrder = copyFieldsToNewObject(record, trackStatusChange) // Reset change tracking fields
    updatedOrder.field_264 = now // Status update date
  }

  //Has it just been recieved?
  if (isJustReceived) {
    updatedOrder.field_22 = today; //set to order received date to today
    sendOrderReceivedNotifications(record)
    if (record.field_591 === 'Apartments') changeStatusInPortal(record.field_10_raw[0].id, 'order_received', '', '')
  }

  //Was this record stocktake today?
  if (isStockTakeToday) {
    updatedOrder.field_1000 = record.field_1000_raw // Set the stocktake bay to the current bay
  }

  //Update the record
  updateRecordPromise('object_5', record.id, updatedOrder)

}

async function sendOrderReceivedNotifications(record) {

  let zapData = {}

  zapData.orderID = record.id;
  zapData.jobID = record.field_10_raw["0"].id;
  zapData.bays = record.field_90.length>0 ? getConnectionIdentifiers(record.field_90) : ''
  zapData.supplier = record.field_1446_raw["0"].identifier;
  zapData.quantity = record.field_17;
  zapData.product = record.field_11_raw["0"].identifier;
  zapData.deliveryLocation = record.field_111;
  zapData.notes = record.field_18;
  zapData.status = status;

  let job = await getRecordPromise('object_3', record.field_10_raw[0].id)
  zapData.jobStatus = job.field_245_raw[0].identifier
  zapData.jobName = job.field_296

  // Get salesperson details
  if(job.field_1276.length>0){
    let salesperson = await getRecordPromise('object_82', job.field_1276_raw[0].id)
    zapData.salesEmail = salesperson.field_957_raw.email
  }

  // Get salesperson details
  if(job.field_1277.length>0){
    let opsperson = await getRecordPromise('object_68', job.field_1277_raw[0].id)
    zapData.opsEmail = opsperson.field_814_raw.email
  }

  // Send email to salesperson
  triggerZap('eak2n4', zapData, 'order received notification sent');
}

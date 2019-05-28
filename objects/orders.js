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

function processOrderChanges(record) {

  //Set general variables to use in code below and make it more readable
  var status = record.field_442_raw["0"].identifier;
  var previousStatus = record.field_443.length > 0 ? record.field_443_raw["0"].identifier : undefined;
  var isStatusChanged = record.field_263;
  var isReceivedByBayEntry = status.includes("Ordered") && record.field_90.length > 0 ? true : false;
  var isReceived = isReceivedByBayEntry || (isStatusChanged && status.includes("Warehouse")) ? true : false;
  var today = moment().format("DD/MM/YYYY")
  var updateOrder = {}; //If we have to update the opportuinty, we'll need this:
  var data = {}; //For sending through to Zapier
  var bays = [];
  var bayNames = "";

  //Get bays incase they are needed
  if (typeof record.field_90_raw !== 'undefined') {
    for (var i = 0; i < record.field_90_raw.length; i++) {
      bays.push(record.field_90_raw[i].id);
      bayNames += record.field_90_raw[i].identifier;
      if (record.field_90_raw[i].id != record.field_90_raw[record.field_90_raw.length - 1].id) {
        bayNames += ', '
      }
    }
  }

  //Take action if status is changed
  if (isStatusChanged) {

    //We'll need to update these fields
    updateOrder.field_443 = record.field_442_raw["0"].id; //set's the previous status field to the current status, removing the 'has changed' flag
    updateOrder.field_264 = today; //status changed date
    updateOrder.field_1395 = 'processOrderChanges() function via Knack JS';

    //Has it just been recieved?
    if (isReceived) {
      //Set date received
      updateOrder.field_22 = today; //set to order received date to today
      updateOrder.field_247 = 'No'; //flag so that standard email gets sent (need to remove later)

      //Was it received implicitly by entering a bay?
      if (isReceivedByBayEntry) {
        //Change status to 'In Warehouse'
        updateOrder.field_442 = '59086d0d86d2272d7a9805db'
        updateOrder.field_443 = '59086d0d86d2272d7a9805db'
      }

      //Notify sales & ops that order has been received.
      data.orderID = record.id;
      data.jobID = record.field_10_raw["0"].id;
      data.bays = bayNames;
      data.supplier = record.field_1446_raw["0"].identifier;
      data.quantity = record.field_17;
      data.product = record.field_11_raw["0"].identifier;
      data.deliveryLocation = record.field_111;
      data.notes = record.field_18;
      data.status = status;

      console.log(status);
      console.log(data);

      triggerZap('eak2n4', data, 'order received notification sent');

    }
  }

  //Was this record stocktake today?
  if (record.field_1001.length > 0) {
    if (record.field_1001_raw.date_formatted == today) {
      //Set the stocktake bay
      updateOrder.field_1000 = bays;
    }
  }

  //Update the record
  updateRecordPromise('object_5', record.id, updateOrder)

}

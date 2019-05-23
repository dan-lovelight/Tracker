//***************************************************************************
//******************* HELPER FUNCTIONS ************* ************************
//***************************************************************************

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

//Get a record
function getRecord(recordType, id) {

  var object = "";

  switch (recordType) {
    case 'job':
      object = "object_3";
      break;
    case 'salesperson':
      object = "object_82";
      break;
    case 'contact':
      object = "object_13";
      break;
    default:
      throw "no object";
  }

  return fetch('https://api.knack.com/v1/objects/' + object + '/records/' + id, {
      method: 'GET',
      headers: myKnackHeaders
    })
    .then(catchFetchErrors)
}

function updateRecordByID(objectName, ID, data) {
  return Promise.try(function() {
      let targetObject = trackerObjects.find(function(object) {
        return object.name === objectName
      })
      if (targetObject === undefined) {
        throw new Error("can't search for a object type that has not in the list")
      } else {
        return targetObject
      }
    })
    .then(function(targetObject) {

      let init = {
        method: 'PUT',
        headers: myKnackHeaders,
        body: JSON.stringify(data)
      }

      return fetch('https://api.knackhq.com/v1/objects/' + targetObject.object + '/records/' + ID, init)

    })
    .then(catchFetchErrors)
    .then(response => response.json())
    .then(response => postToConsole(response, "updateRecordByID"))
}

// Get records for a specificed object and list of IDs
function getRecordsByID(objectName, IDs) {
  return Promise.try(function() {
      let targetObject = trackerObjects.find(function(object) {
        return object.name === objectName
      })
      if (targetObject === undefined) {
        throw new Error("can't search for a object type that has not in the list")
      } else {
        return targetObject
      }
    })
    .then(function(targetObject) {
      return knackSearch(targetObject.object, 'or', 'id', 'is', IDs)
    })
    .then(response => postToConsole(response, "getRecordsByID"))
}

//Search for records in Knack
// object = object to be searched eg object_1
// searchType - 'and' or 'or'
// field - the field to be searched
// operator - 'is', 'contains' etc
// searchValuesArray - an array of values to include in the search filter
function knackSearch(object, searchType, field, operator, searchValuesArray) {
  return Promise.try(function() {

      if (searchValuesArray.length === 0 || !Array.isArray(searchValuesArray)) {
        throw new Error('searchValuesArray value cannot be empty and must be an array')
      }

      let filter = {}
      filter.match = searchType

      let rules = []
      searchValuesArray.map(value => {
        rules.push({
          "field": field,
          "operator": operator,
          "value": value
        })
      })

      filter.rules = rules

      let url = new URL('https://api.knack.com/v1/objects/' + object + '/records/')
      url.search = new URLSearchParams('filters=' + JSON.stringify(filter))
      return url
    })
    .then(function(url) {
      return fetch(url, {
        method: 'GET',
        headers: myKnackHeaders
      })
    })
    .then(catchFetchErrors)
    .then(response => response.json())
    .then(json => {
      return json.records
    })
    .then(response => postToConsole(response, "searchKnack"))
}

// Generic function to post to a Zapier endpoint on the LL accounts
function sendHookToZapier(slug, data, description) {
  return Promise.try(function() {
    return fetch('https://hooks.zapier.com/hooks/catch/2107870/' + slug + '/', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      .then(catchFetchErrors)
      .then(response => postToConsole(response, "sendHookToZapier"))
  })

}

// Handle errors
function errorHandler(error, record) {
  console.log(error)
  let msg = {}
  msg.error = error.name
  msg.stack = error.stack
  msg.recordID = record.id
  msg.callOutName = record.field_1488
  pingDan(msg)
}

// Generic fetch error handling
// fetch doesn ot error when a  call fails
function catchFetchErrors(response) {
  if (!response.ok) {
    throw Error(response.statusText)
  }
  return response
}

// Function used to alert dan of errors etc
function pingDan(msg) {
  return Promise.try(() => {
      return fetch('https://hooks.zapier.com/hooks/catch/2107870/e6mxk1/', {
        method: 'POST',
        body: JSON.stringify(msg)
      })
    })
    .then(catchFetchErrors)
    .then(response => postToConsole(response, 'pingDan ran'))
}

// Log a step in the console
function postToConsole(response, message) {
  console.log(message)
  return response
}

function hideEmptyTables(scene) {
  //Iterate throught eacy view in the page
  scene.views.map(function(view) {
    // If the view has row data (ie it's a table) AND that data is 0...
    // console.log(Knack.models[view.key]);
    if (view.type === 'table' && Knack.models[view.key].data.length < 1) {
      //Hide it
      $('#' + view.key).remove();
    }
  });
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

const trackerObjects = [{
  name: 'jobs',
  object: 'object_3'
}, {
  name: 'callouts',
  object: 'object_78'
}, {
  name: 'installers',
  object: 'object_71'
}, {
  name: 'invoices',
  object: 'object_19'
},{
  name: 'orders',
  object: 'object_5'
},
{
  name: 'opportunities',
  object: 'object_17'
}
]

$(document).on('knack-view-render.any', function(event, scene) {
  var $submitButtonArray = $(".kn-submit input[type=submit]");
  $submitButtonArray.each(function(index) {
    var $submitButton = $(this);
    if ($submitButton.attr("value") === "Submit") {
      $submitButton.attr("value", "Save");
    }
  });
});

$(document).on('knack-page-render.any', function(event, page) {
  $(".kn-back-link a").html("<i class='fa fa-chevron-circle-left'></i> Previous");
});


//***************************************************************************
//******************* ADD LINKS TO MENU *************************************
//***************************************************************************

$(document).on('knack-scene-render.any', function(event, scene) {

  let userRoles = Knack.getUserRoles()

  if(Knack.getUserAttributes()!='No user found' && !(userRoles.length == 1 && userRoles[0] == 'object_71')){ // not logged in or an installer

    //Portal
    var myElem = document.getElementById('portal');
    if (myElem === null) {
      $("#app-menu-list").append("<li id='portal'><a href='https://portal.lovelight.com.au' target='_blank'>Portal</a></li>");
      $("#portal > a").css('background-color', '#dddddd');
    }

    //Xero
    myElem = document.getElementById('xero');
    if (myElem === null) {
      $("#app-menu-list").append("<li id='xero'><a href='https://go.xero.com/Dashboard/' target='_blank'>Xero</a></li>");
      $("#xero > a").css('background-color', '#048abb');
    }

    //Helpsite
    myElem = document.getElementById('help-centre');
    if (myElem === null) {
      $("#app-menu-list").append("<li id='help-centre'><a href='http://lovelight.helpsite.io/' target='_blank'>Helpsite</a></li>");
      $("#help-centre > a").css('background-color', '#07467c');
    }

    //Change colour of Templates Tab
    $("li > a > span:contains('Templates')").parent().css('background-color', '#217346');

  }
});

//***************************************************************************
//******************* HIDE EMPTY TABLES *************************************
//***************************************************************************

//My Opportunities dashboard
$(document).on('knack-scene-render.scene_246', function(event, scene) {
  hideEmptyTables(scene)
});

//My Jobs dashboard
$(document).on('knack-scene-render.scene_247', function(event, scene) {
  hideEmptyTables(scene)
});

//My Orders dashboard
$(document).on('knack-scene-render.scene_248', function(event, scene) {
  hideEmptyTables(scene)
});

//My Invoices dashboard
$(document).on('knack-scene-render.scene_249', function(event, scene) {
  hideEmptyTables(scene)
});

//My To Quote dashboard
$(document).on('knack-scene-render.scene_417', function(event, scene) {
  hideEmptyTables(scene)
});

//My Jobs
$(document).on('knack-scene-render.scene_1578', function(event, scene) {
  hideEmptyTables(scene)
});

//My Opportunities
$(document).on('knack-scene-render.scene_707', function(event, scene) {
  if (Knack.models["view_1583"].data.length == 0) {
    $('#view_1583').remove();
  }
  if (Knack.models["view_1640"].data.length == 0) {
    $('#view_1640').remove();
  }
  if (Knack.models["view_1641"].data.length == 0) {
    $('#view_1641').remove();
  }
});

//My Invoices
$(document).on('knack-scene-render.scene_720', function(event, scene) {
  hideEmptyTables(scene)
});

//Remakes
$(document).on('knack-scene-render.scene_956', function(event, scene) {
  hideEmptyTables(scene)
});
//Track Remakes
$(document).on('knack-scene-render.scene_959', function(event, scene) {
  hideEmptyTables(scene)
});

//***************************************************************************
//******************* ADD MULTISELECT STOCKTAKE FUNCTIONALITY ***************
//***************************************************************************

//Stocktake page
$(document).on('knack-view-render.view_1287', function(event, view) {

  // Add an update button
  $('<div style="padding:15px 15px 15px 0px"><a id="confirmStockTake" class="kn-button">Confirm Selected</a></div>').insertAfter($('#view_1287 .view-header'));

  // Add checkboxes to our table
  addCheckboxes(view);

  // Click event for the update button
  $('#confirmStockTake').click(function() {

    // We need an array of record IDs
    var record_ids = [];

    // Populate the record IDs using all checked rows
    $('#' + view.key + ' tbody input[type=checkbox]:checked').each(function() {
      record_ids.push($(this).closest('tr').attr('id')); // record id
    });

    let recordURL = 'https://api.knack.com/v1/objects/object_5/records/'
    let data = {}

    data.field_1001 = {
      "date": moment().format("DD/MM/YYYY"),
      "hours": moment().format("h"),
      "minutes": moment().format("mm"),
      "am_pm": moment().format("a"),
    }

    let recordRequestLoop = function(arrayOfIDs) {
      let promiseArray = [];
      for (let i = 0; i <= record_ids.length - 1; i++) {
        let targetRecord = recordURL + record_ids[i];
        promiseArray.push(fetch(targetRecord, {
          method: 'PUT',
          body: JSON.stringify(data),
          headers: myKnackHeaders
        }).then(function(response) {
          return response.json();
        }).then(function(json) {
          return json.id; //just need something to indicate it worked, don't care what
        })).catch(errorHandler)
      }
      return Promise.all(promiseArray);
    }

    //Show modal
    swal({
        text: 'Update stocktake date for ' + record_ids.length + " records?",
        //content: "input",
        button: {
          text: "Update Now",
          closeModal: false,
        },
      })
      .then(name => {
        return recordRequestLoop(record_ids);
      })
      .then(json => {
        swal({
          title: "Update complete",
          text: json.length + " records updated",
        });
      })
      .then(resp => {
        Knack.views["view_1287"].model.fetch();
      })
      .catch(err => {
        if (err) {
          swal("Something went wrong!", err, "error");
        } else {
          swal.stopLoading();
          swal.close();
        }
      });
  })
});

//***************************************************************************
//******************* WHEN CREATE/EDIT CALL OUT FORMS ARE RENDERED **********
//***************************************************************************


/* Limit the time selection options in the create callout form*/
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/add-a-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_641/views/view_1437
//*************THIS USUALLY WORKS BUT A BIT INCONSISTENT
$(document).on('knack-view-render.view_1437', function(event, view, data) {
  $('#view_1437-field_924-time').timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': false
  });

  //Update to time when it get's the focus
  //*************THIS SOMETIMES WORKS, BUT ONLY WHEN THE FIELD IS EMPTY
  $("input#view_1437-field_924-time-to").on('focus', function() {

    var startTime = $('#view_1437-field_924-time').val();

    //console.log(startTime);

    $('#view_1437-field_924-time-to').timepicker({
      'showClear': true,
      'minTime': startTime,
      'maxTime': '8:00pm',
      'showDuration': true
    });

  });

});

/* Limit the time selection options in the create callout form*/
// https://lovelight.knack.com/tracker#jobs/view-job-details/{id}/edit-call-out/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_576/views/view_1294
$(document).on('knack-view-render.view_1294', function(event, view, data) {
  $('#view_1294-field_924-time').timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': false
  });

  //Update to time when it get's the focus
  $("input#view_1294-field_924-time-to").on('focus', function() {

    var startTime = $('#view_1294-field_924-time').val();

    //console.log(startTime);

    $('#view_1294-field_924-time-to').timepicker({
      'showClear': true,
      'minTime': startTime,
      'maxTime': '8:00pm',
      'showDuration': true
    });

  });

});

/* Limit the time selection options in the create callout form*/
// https://lovelight.knack.com/tracker#developments/view-development-details/{id}/
// https://builder.knack.com/lovelight/tracker#pages/scene_1024/views/view_2126
$(document).on('knack-view-render.view_2126', function(event, view, data) {
  $('#view_2126-field_924-time').timepicker({
    'minTime': '5:00am',
    'maxTime': '8:00pm',
    'showDuration': false
  });

  //Update to time when it get's the focus
  $("input#view_2126-field_924-time-to").on('focus', function() {

    var startTime = $('#view_2126-field_924-time').val();

    //console.log(startTime);

    $('#view_2126-field_924-time-to').timepicker({
      'showClear': true,
      'minTime': startTime,
      'maxTime': '8:00pm',
      'showDuration': true
    });

  });

});

// ***************************************************************************
// ******************* WHEN A CALL OUT IS UPDATED ****************************
// ***************************************************************************

function processCallOutChanges(record) {
  updateCallOutDataForChanges(record)
    .then((updatedRecord) => {
      return updateCallOutCalendarEvents(record, updatedRecord)
    })
    .catch((err) => errorHandler(err, record))
  //.then(() => { Knack.views["view_1347"].model.fetch() })
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

function getCallOutChangeResetData(callOut) {
  return Promise.try(() => {
    let updateData = {}
    // isTimeUpdated
    if (JSON.stringify(callOut.field_1026) !== JSON.stringify(callOut.field_924)) {
      updateData.field_1026 = {
        date: callOut.field_924_raw.date_formatted,
        hours: callOut.field_924_raw.hours,
        minutes: callOut.field_924_raw.minutes,
        am_pm: callOut.field_924_raw.am_pm,
        to: {
          date: callOut.field_924_raw.to.date_formatted,
          hours: callOut.field_924_raw.to.hours,
          minutes: callOut.field_924_raw.to.minutes,
          am_pm: callOut.field_924_raw.to.am_pm
        }
      }
    }
    // isInstallerUpdated
    if (JSON.stringify(callOut.field_1034) !== JSON.stringify(callOut.field_927)) {
      updateData.field_1034 = getConnectionIDs(callOut.field_927_raw)
    }

    // is Sales Updated
    if (JSON.stringify(callOut.field_985) !== JSON.stringify(callOut.field_1504)) {
      updateData.field_1504 = getConnectionIDs(callOut.field_985_raw)
    }

    // is Ops Updated
    if (JSON.stringify(callOut.field_1474) !== JSON.stringify(callOut.field_1505)) {
      updateData.field_1505 = getConnectionIDs(callOut.field_1474_raw)
    }

    // is Other Attendees Updated
    if (JSON.stringify(callOut.field_1503) !== JSON.stringify(callOut.field_1506)) {
      updateData.field_1506 = callOut.field_1503
    }

    // isAddressUpdated
    if (JSON.stringify(callOut.field_981) !== JSON.stringify(callOut.field_1478)) {
      if (callOut.field_981.length > 0) {
        updateData.field_1478 = {
          street: callOut.field_981_raw.street,
          street2: callOut.field_981_raw.street2,
          city: callOut.field_981_raw.city,
          state: callOut.field_981_raw.state,
          zip: callOut.field_981_raw.zip
        }
      } else {
        updateData.field_1478 = {
          street: '',
          street2: '',
          city: '',
          state: '',
          zip: ''
        }
      }
    }

    // isStatusUpdated
    if (JSON.stringify(callOut.field_955) !== JSON.stringify(callOut.field_1028)) {
      updateData.field_1028 = callOut.field_955
    }
    // isTypeUpdated
    if (JSON.stringify(callOut.field_925) !== JSON.stringify(callOut.field_1492)) {
      updateData.field_1492 = callOut.field_925
    }
    // isJobUpdated
    if (JSON.stringify(callOut.field_928) !== JSON.stringify(callOut.field_1493)) {
      updateData.field_1493 = getConnectionIDs(callOut.field_928_raw)
    }
    if (Object.entries(updateData).length === 0) {
      console.log('No reset data required')
    }
    return updateData
  })
}

function getCallOutUpdateDataFromJob(callOut) {
  return Promise.try(() => {
    if (callOut.field_928.length > 0 && callOut.field_1492.length === 0) {
      // The callout has just had a job added
      return Promise.try(() => {
          let jobIDs = getConnectionIDs(callOut.field_928_raw)
          let firstJob = []
          firstJob.push(jobIDs['0']) // Can currently only handle a single job
          return getRecordsByID('jobs', firstJob)
        })
        .then((jobs) => {
          return jobs['0']
        })
        .then((job) => {
          let updateData = {}

          // Get the salesperson if available
          if (job.field_1276.length > 0) {
            updateData.field_985 = job.field_1276_raw['0'].id
          }

          // Get the opsperson if available
          if (job.field_1277.length > 0) {
            updateData.field_1474 = job.field_1277_raw['0'].id
          }

          // Get the site contact if required and available
          if (callOut.field_1025.length === 0 && callOut.field_1024 === 'Yes' && job.field_432.length > 0) {
            updateData.field_1025 = job.field_432_raw['0'].id
          }

          // Get the address if required and available
          if (callOut.field_981 === '' && callOut.field_982 === 'Yes' && job.field_12 !== '') {
            updateData.field_981 = {
              street: job.field_12_raw.street,
              street2: job.field_12_raw.street2,
              city: job.field_12_raw.city,
              state: job.field_12_raw.state,
              zip: job.field_12_raw.zip
            }

          // If updating from the Job, need to also update the 'previous' address field
          // This is usually set by getCallOutChangeResetData. As this runs in parallel the previous field isn't updated
          updateData.field_1478 = updateData.field_981

          }

          // Get the state
          updateData.field_1494 = [job.field_58]

          // Get the busines unit
          if(job.field_59 === 'Apartments' || job.field_59 === 'Projects') {
          updateData.field_1495 = ['Commercial']
          } else {
            updateData.field_1495 = [job.field_59]
          }

          // Get the development if available
          if (job.field_186.length > 0) {
            updateData.field_1482 = job.field_186_raw['0'].id
          }

          return updateData
        })
    } else {
      console.log('There are no job updates')
      return {}
    }
  })
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
https://builder.knack.com/lovelight/tracker#pages/scene_950/views/view_1967
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

//***************************************************************************
//******************* ALL FORMS THAT UPDATE OPPORTUNITIES********************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add Opportunity
//https://builder.knack.com/lovelight/tracker#pages/scene_413/views/view_934
$(document).on('knack-record-create.view_934', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_691/views/view_1542
//https://lovelight.knack.com/tracker#opportunities/new-quote-request/
$(document).on('knack-record-create.view_1542', function(event, view, record) {
  console.log(record);
  //Create ticket in ZD for new quote request
  sendHookToZapier('lq798w', record, 'new quote request')
  processOpportunityChanges(record);
});

//******************* FORM SUBMITTED ****************************************

//https://builder.knack.com/lovelight/tracker#pages/scene_475/views/view_1069
$(document).on('knack-form-submit.view_1069', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_49/views/view_87
$(document).on('knack-form-submit.view_87', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_414/views/view_949
$(document).on('knack-form-submit.view_949', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_415/views/view_950
$(document).on('knack-form-submit.view_950', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_455/views/view_1023
$(document).on('knack-form-submit.view_1023', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_456/views/view_1024
$(document).on('knack-form-submit.view_1024', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//https://builder.knack.com/lovelight/tracker#pages/scene_456/views/view_1661
$(document).on('knack-form-submit.view_1661', function(event, view, record) {
  console.log(record);
  processOpportunityChanges(record);
});

//***************************************************************************
//******************* WHEN AN OPPORTUNITY IS UPDATED ************************
//***************************************************************************
function processOpportunityChanges(record) {

  //Set variables
  var quotedNotificationValue = 50000;
  var saleNotificationValue = 10000;

  //Gather required data & variables

  //If we have to update the opportuinty, we'll need this:
  var updateOpp = {};
  updateOpp.field_258 = record.field_127; //set's the previous status field to the current status, removing the 'has chagned' flag

  //Set general variables to use in code below and make it more readable
  var status = record.field_127;
  var statusPrevious = record.field_258;
  var statusChanged = record.field_259;
  var value = record.field_128.length > 0 ? parseInt(record.field_128_raw.replace(/\,/g, '')) : undefined;
  var salesPerson = record.field_1274.length > 0 ? record.field_1274_raw["0"].identifier : undefined;
  var quotedBy = record.field_1275.length > 0 ? record.field_1275_raw["0"].identifier : salesPerson;
  var company = record.field_1460.length > 0 ? record.field_1460_raw["0"].identifier : undefined;
  var state = record.field_117;

  //If we need to trigger zaps, they'll need this information
  var zapierData = {};
  zapierData.status = status;
  zapierData.opportunity = record.field_123_raw;
  zapierData.value = value;
  zapierData.value_formatted = record.field_128_raw.split(".")[0];
  zapierData.salesPerson = salesPerson;
  zapierData.quotedBy = quotedBy;
  zapierData.company = company;

  console.log(status, statusPrevious, statusChanged, value, salesPerson, quotedBy, company);

  if (statusChanged == 'Yes') {

    //Has this opportunity just been quoted?
    if (status == 'Open' && statusPrevious !== 'Lost' && statusPrevious !== 'Won' && value >= quotedNotificationValue && typeof quotedBy !== 'undefined') {
      //Send to Zapier for Slack update
      sendHookToZapier('l5tgdk', zapierData, 'Quote!');
    }

    if (status == 'Won') {
      //Add closed date to opportunity update object
      updateOpp.field_132 = moment().format("DD/MM/YYYY h:mm a");
      //console.log("status Changed to won "+ updateOpp.field_132);

      if (value >= saleNotificationValue) {

        if (salesPerson.indexOf('Jeremy') === -1) {
          zapierData.salesPersonCredit = salesPerson;
        } else {
          zapierData.salesPersonCredit = quotedBy
        }

        //console.log("value is >1000, credit to "+ zapierData.salesPersonCredit);

        //Send to Zapier for Slack update
        sendHookToZapier('l5tx9j', zapierData, 'Sale!');

      } //end value>1000

      //Notify QLD channel about all wins
      if (state == 'QLD' && value < saleNotificationValue) {
        zapierData.salesPersonCredit = salesPerson;
        sendHookToZapier('e337ri', zapierData, 'QLD Sale!');
      }

      //Does this opportunity have a company?
      if (typeof company !== 'undefined') {

        //console.log("there is a company");
        sendHookToZapier('l5hoyo', zapierData, 'Opportunity has a company');

      } //end company
    } //end won

    //The status has changed. Set previous status to current status to reset the flag
    updateRecordByID('opportunities', record.id, updateOpp)

  } //end status changed
}

//***************************************************************************
//******************* ALL EVENTS THAT UPDATE JOBS ***************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

// https://lovelight.knack.com/tracker#dashboard/jobs2/add-job/
// https://builder.knack.com/lovelight/tracker#pages/scene_18/views/view_33
$(document).on('knack-record-create.view_33', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});

// https://lovelight.knack.com/tracker#jobs/view-job-details
// https://builder.knack.com/lovelight/tracker#pages/scene_244/views/view_609
$(document).on('knack-record-create.view_609', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});

// https://lovelight.knack.com/tracker#custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity2
// https://builder.knack.com/lovelight/tracker#pages/scene_776/views/view_1671
$(document).on('knack-record-create.view_1671', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});

// https://lovelight.knack.com/tracker#custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity
// https://builder.knack.com/lovelight/tracker#pages/scene_776/views/view_1670
$(document).on('knack-record-create.view_1670', function(event, view, record) {
  console.log(record);
  addJobToJobRec(record)
});


//******************* FORM SUBMITTED ****************************************

//All My Jobs
//https://lovelight.knack.com/tracker#dashboard/jobs2/
//https://builder.knack.com/lovelight/tracker#pages/scene_247/views/view_277
$(document).on('knack-form-submit.view_277', function(event, view, record) {
  console.log(record);
});

//******************* INLINE EDITS ******************************************

//My Issue Jobs
//https://lovelight.knack.com/tracker#dashboard/jobs2/
//https://builder.knack.com/lovelight/tracker#pages/scene_247/views/view_402
$(document).on('knack-cell-update.view_402', function(event, view, record) {
  console.log(record);
});

//All My Jobs
//https://lovelight.knack.com/tracker#dashboard/jobs2/
//https://builder.knack.com/lovelight/tracker#pages/scene_247/views/view_277
$(document).on('knack-cell-update.view_277', function(event, view, record) {
  console.log(record);
});

//******************** CREATE JOB IN JOBREC ********************************

function addJobToJobRec (job) {
	let url = 'https://api.jobrecapp.com/v1/jobs/'
    let data = {
      'name': job.field_296,
      'source': 'Tracker',
      'sourceId': job.id,
      'ownerName': job.field_1276_raw[0].identifier,
      'ownerEmail': job.field_715,
      'url': 'https://lovelight.knack.com/tracker#jobs/view-job-details/' + job.id,
      'value': job.field_130_raw.replace(/,/g, ''),
      'client': job.field_1332
    }

    let init = {
        method: 'POST',
        headers: myJobRecHeaders,
        body: JSON.stringify(data)
      }

  return fetch(url, init)
}

//******************** VIEW JOB DETAILS ********************************
$(document).on('knack-scene-render.scene_52', function(event, scene) {
	hideEmptyTables(scene)
})

//***************************************************************************
//******************* ALL EVENTS THAT UPDATE ORDERS *************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add estimate
$(document).on('knack-record-create.view_1139', function(event, view, record) {
  processOrderChanges(record);
});

//Add order
$(document).on('knack-record-create.view_96', function(event, view, record) {
  processOrderChanges(record);
});

//Record Stock Usage
$(document).on('knack-record-create.view_1019', function(event, view, record) {
  processOrderChanges(record);
});

//Create Related Order
$(document).on('knack-record-create.view_1000', function(event, view, record) {
  processOrderChanges(record);
});

//******************* FORM SUBMITTED ****************************************

//Edit Estimate
$(document).on('knack-form-submit.view_1140', function(event, view, record) {
  processOrderChanges(record);
});

//Edit Order
$(document).on('knack-form-submit.view_223', function(event, view, record) {
  processOrderChanges(record);
});

//Change Order Status
$(document).on('knack-form-submit.view_997', function(event, view, record) {
  processOrderChanges(record);
});

//Update Storage Bay
$(document).on('knack-form-submit.view_1333', function(event, view, record) {
  processOrderChanges(record);
});

//Update Carton Number
$(document).on('knack-form-submit.view_1334', function(event, view, record) {
  processOrderChanges(record);
});

//Warehouse Change Order Status
$(document).on('knack-form-submit.view_1353', function(event, view, record) {
  processOrderChanges(record);
});

//******************* INLINE EDITS ******************************************

//Job details table
$(document).on('knack-cell-update.view_97', function(event, view, record) {
  processOrderChanges(record);
});

//Search Orders
$(document).on('knack-cell-update.view_1087', function(event, view, record) {
  processOrderChanges(record);
});

//Related orders table in order details
$(document).on('knack-cell-update.view_998', function(event, view, record) {
  processOrderChanges(record);
});

//Stocktake table
$(document).on('knack-cell-update.view_1287', function(event, view, record) {
  processOrderChanges(record);
});

//Deliver manifest table
$(document).on('knack-cell-update.view_1332', function(event, view, record) {
  processOrderChanges(record);
});

//Recently received table
$(document).on('knack-cell-update.view_1335', function(event, view, record) {
  processOrderChanges(record);
});

//******************* REMAKE PAGES ***************************************



//******************* ORDER FUNCTIONS ***************************************

function processOrderChanges(record) {

  console.log(record);

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

      sendHookToZapier('eak2n4', data, 'order received notification sent');

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
  updateRecordByID('orders', record.id, updateOrder)

}

//***************************************************************************
//******************* INVOICE FORMS *****************************************
//***************************************************************************

//******************* RECORD CREATED ****************************************

//Add Invoice
//https://lovelight.knack.com/tracker#jobs/view-job-details/{}/add-invoice/{}/
//https://builder.knack.com/lovelight/tracker#pages/scene_68/views/view_127
$(document).on('knack-record-create.view_127', function(event, view, record) {
  processNewInvoiceRecord(record);
});

//Add Invoice - manage invoices
//
$(document).on('knack-record-create.view_163', function(event, view, record) {
  processNewInvoiceRecord(record);
});

//Issue Invoice
$(document).on('knack-form-submit.view_1751', function(event, view, record) {
  issueInvoice(record);
})

//***************************************************************************
//******************* PROCESS NEW INVOICE ***********************************
//***************************************************************************

function processNewInvoiceRecord(record) {

  var jobID = record.field_155_raw['0'].id;
  var percentageDue = record.field_1403;

  console.log(percentageDue);

  var data = {};

  //Get the details of the invoice's job
  var getJob = fetch('https://api.knack.com/v1/objects/object_3/records/' + jobID, {
      method: 'GET',
      headers: myKnackHeaders
    })
    .then(function(res) {
      return res.json();
    })
    .then(function(job) {

      //If there is a company we'll use the company name, otherwise the contact name
      if (job.field_1459.length > 0) {
        data.field_1398 = job.field_1459_raw['0'].identifier; //This needs to be updated when we migrate companies data
      } else {
        data.field_1398 = job.field_80_raw['0'].identifier;
      }

      if (percentageDue != 'Other') {
        data.field_154 = parseInt(job.field_130_raw.replace(/\,/g, '')) * parseInt(percentageDue.replace(/\%/g, '')) / 100;
        console.log(job.field_130_raw.replace(/\,/g, ''))
        console.log(parseInt(job.field_130_raw.replace(/\,/g, '')))

        console.log(data.field_154);
      }
    })
    .then(function() {

      console.log(data);

      //write details back to the invoice
      updateRecordByID('invoices', record.id, data)

    })

}


//***************************************************************************
//******************* ISSUE INVOICE ****************************************
//***************************************************************************

function issueInvoice(record) {

  //Invoice Variables
  var invoiceID = record.id;
  var invoiceAccount = record.field_1398;
  var invoiceContactID = record.field_1396_raw["0"].id;
  var invoiceValueFormatted = record.field_154;
  var invoiceValue = parseInt(record.field_154_raw.replace(/\,/g, ''));
  var invoicePercent = record.field_156;
  var invoiceType = record.field_313;
  var dueDateOption = record.field_1399;
  var invoiceDueDate; //= record.field_835 > 0 ? record.field_835_raw.date_formatted : undefined;
  var invoiceDueDateUTC;
  var invoiceService = record.field_314 == 'Other' ? record.field_315 : record.field_314;
  var invoicePO = record.field_319.length > 0 ? 'PO Number: ' + record.field_319 : undefined;
  var xeroAccount = "";
  var xeroAccountNumber = "";
  var description = "";

  //Job Varialbes
  var jobRecord;
  var jobID = record.field_155_raw['0'].id;
  var jobSite = "";
  var jobState = "";
  var jobValue = 0;
  var jobValueFormatted = "";
  var jobValueInvoiced = 0;
  var jobValueRemaining = "";
  var jobName = record.field_155_raw['0'].identifier;
  var jobSalesID = "";

  //Salesperson Variables
  var salespersonRecord;
  var salesPersonEmail = ""

  //Flag on printing to console or not
  var debug = true;

  //Required to look up accounts based on job details
  var xeroAccounts = [{
      id: 0,
      account: 'VIC - Custom',
      number: 41000
    },
    {
      id: 1,
      account: 'VIC - Apartments',
      number: 41002
    },
    {
      id: 2,
      account: 'VIC - Projects',
      number: 41600
    },
    {
      id: 3,
      account: 'VIC - Displays',
      number: 41031
    },
    {
      id: 4,
      account: 'VIC - FF&E',
      number: 41606
    },
    {
      id: 5,
      account: 'VIC - Volume',
      number: 41030
    },
    {
      id: 6,
      account: 'NSW - Custom',
      number: 41006
    },
    {
      id: 7,
      account: 'NSW - Apartments',
      number: 41007
    },
    {
      id: 8,
      account: 'NSW - Projects',
      number: 41602
    },
    {
      id: 9,
      account: 'NSW - Displays',
      number: 41035
    },
    {
      id: 10,
      account: 'NSW - Volume',
      number: 41034
    },
    {
      id: 11,
      account: 'QLD - Custom',
      number: 41003
    },
    {
      id: 12,
      account: 'QLD - Apartments',
      number: 41004
    },
    {
      id: 13,
      account: 'QLD - Projects',
      number: 41601
    },
    {
      id: 14,
      account: 'QLD - Displays',
      number: 41033
    },
    {
      id: 15,
      account: 'QLD - Volume',
      number: 41032
    },
    {
      id: 16,
      account: 'SA - Custom',
      number: 41039
    },
    {
      id: 17,
      account: 'SA - Apartments',
      number: 41008
    },
    {
      id: 18,
      account: 'SA - Projects',
      number: 41603
    },
    {
      id: 19,
      account: 'SA - Displays',
      number: 41038
    },
    {
      id: 20,
      account: 'SA - Volume',
      number: 41036
    }
  ];

  //Set the invoice due date
  if (record.field_1399.indexOf('Immediately') >= 0) {
    invoiceDueDate = moment().format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().format();
  } else if (record.field_1399.indexOf('7 days') >= 0) {
    invoiceDueDate = moment().add(7, 'days').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(7, 'days').format();
  } else if (record.field_1399.indexOf('14 days') >= 0) {
    invoiceDueDate = moment().add(14, 'days').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(14, 'days').format();
  } else if (record.field_1399.indexOf('30 days') >= 0) {
    invoiceDueDate = moment().add(30, 'days').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(30, 'days').format();
  } else if (record.field_1399.indexOf('End of next month') >= 0) {
    invoiceDueDate = moment().add(1, 'months').endOf('month').format("DD/MM/YYYY");
    invoiceDueDateUTC = moment().add(1, 'months').endOf('month').format();
  } else if (record.field_1399.indexOf('Pick a date') >= 0) {
    invoiceDueDate = record.field_835_raw.date_formatted;
    invoiceDueDateUTC = moment(invoiceDueDate, "DD/MM/YYYY").format();
  } else { //date is missing, defulat to today
    invoiceDueDate = moment().format("DD/MM/YYYY")
    invoiceDueDateUTC = moment().format();
  }

  //Create formatter for reformatting currency after calculation
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  })

  var getJob = getRecord('job', jobID)
    .then(function(res) {
      return res.json();
    })
    .then(function(job) {

      jobSite = job.field_12.replace(/<\/?[^>]+(>|$)/g, " ");
      jobValue = parseInt(job.field_130_raw.replace(/\,/g, ''));
      jobValueFormatted = job.field_130;
      jobValueInvoiced = parseInt(job.field_162.replace(/\,/g, '').replace(/\$/g, ''));
      jobValueRemaining = formatter.format(jobValue - jobValueInvoiced);

      jobRecord = job;
      jobState = job.field_58;
      jobSalesID = job.field_1276_raw["0"].id;
      xeroAccount = jobState + ' - ' + job.field_59;
      xeroAccountNumber = xeroAccounts.find(xeroAccountNumber => xeroAccountNumber.account == xeroAccount).number;
      description = "";

      //Build invoice description
      if (jobSite.length > 0) { //Don't include job site if this is blank
        description = "Site address: " + jobSite + '\n\n';
      }
      //Add the service being provided
      description += invoiceService + '\n\n';

      //Add the job value
      if (invoiceType != 'Call Out Fee') {
        description += 'Total Job Value: ' + jobValueFormatted + ' excluding GST.\n' + invoicePercent + ' ' + invoiceType + ' due.\n'
      }

      //Add variable detail
      if (invoiceType == 'Balance') {
        description += 'Payment due before installation.';
      } else if (invoiceType == 'Deposit') {
        description += 'Payment due to commence works.';
      } else if (invoiceType == 'Installment') {
        description += 'Total remaining to be invoiced is ' + jobValueRemaining;
      } else if (invoiceType == 'Call Out Fee') {
        description += 'Payment due prior to service call'
      }

      //Add PO number if present
      if (invoicePO !== undefined) {
        description += '\n\n' + invoicePO;
      }

    })
    .catch(function(error) {
      console.log('Request failed', error)
    })

  var getSales = getJob.then(function() {

      return getRecord('salesperson', jobSalesID);
    })
    .then(function(res) {
      return res.json();
    })
    .then(function(salesperson) {
      salespersonRecord = salesperson;
      salesPersonEmail = salesperson.field_957_raw.email;
    })
    .then(function() {

      console.log('ready to create invoice!');

      var data = {};

      data.invoiceID = invoiceID;
      data.invoiceContactID = invoiceContactID;
      data.invoiceContactName = invoiceAccount;
      data.dueDate = invoiceDueDate;
      data.dueDateFormatted = invoiceDueDateUTC;
      data.reference = jobName;
      data.description = description;
      data.invoiceValue = invoiceValue;
      data.accountCode = xeroAccountNumber;
      data.state = jobState;
      data.salesPerson = salesPersonEmail;

      return sendHookToZapier('cmjwd2', data, 'Create Invoice');

    })
    .then(function() {

      if (debug) {

        console.log(jobRecord);
        console.log(salespersonRecord);
        console.log('Job ID: ' + jobID);
        console.log('Job Name: ' + jobName);
        console.log('Invoice Account: ' + invoiceAccount);
        console.log('Invoice Contact ID: ' + invoiceContactID);
        console.log('FOrmatted Invoice Value: ' + invoiceValueFormatted);
        console.log('Raw Invoice Value: ' + invoiceValue);
        console.log('Invoice Percent: ' + invoicePercent);
        console.log('Invoice Type: ' + invoiceType);
        console.log('Due Date Option: ' + dueDateOption);
        console.log('Original Due Date: ' + invoiceDueDate);
        console.log('Adjusted Due Date: ' + invoiceDueDate);
        console.log('Service Provided: ' + invoiceService);
        console.log('PO Number: ' + invoicePO);
        console.log('Job Site: ' + jobSite);
        console.log('Job Value: ' + jobValue);
        console.log('Job Value Formatted: ' + jobValueFormatted);
        console.log('Total Invoiced Value: ' + jobValueInvoiced);
        console.log('Value Yet To Be Invoiced: ' + jobValueRemaining);
        console.log('Xero Account: ' + xeroAccount);
        console.log('Xero Account Number: ' + xeroAccountNumber);
        console.log('Description: ' + description);
        console.log('Sales email: ' + salesPersonEmail);
      }

    })
    .catch(function(error) {
      console.log('Request failed', error)
    })

}

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

//***************************************************************************
//******************* REMOVE HEADER ON SCHEDULING CALENDAR ******************
//***************************************************************************

// view 1347 update to hide calendar header.
$(document).on('knack-records-render.view_1347', function(event, view, records) {

  //function removeHeader() {
  //  $('div.fc-event-head').hide();
  // }

  //setTimeout(removeHeader, 1000);
});

//***************************************************************************
//******************* INSTALLERS ******************
//***************************************************************************
$(document).on('knack-scene-render.scene_642', function(event, scene) {

    $('#view_2072, #view_2071').detach().prependTo('#view_2062 .control') // Move no issues button into menu
    $('#view_1442').css({"clear":"both","margin-top":"2em"}) // Details view below buttons
    $('#view_2071, #view_2072').css({"float":"left","margin-right":"0.6em","margin-bottom":"5px"}) // Format button in menu

});

$(document).on('knack-scene-render.scene_509', function(event, scene) {

//  const target = document.getElementById('view_2057');
//  const options = {
//    attributes: true,
//    attributeOldValue: true,
//  };
//  const observer = new MutationObserver(callback);

//  function callback (mutations) {

//   mutations.forEach((mutation) => {
//		console.log(mutation)
//    })
//  }

//  observer.observe(target, options);
debugger
  waitForAddedNode({
    id: 'view_2057',
    parent: document.querySelector('.container'),
    recursive: false,
    done: function(el) {
        console.log(el);
    }
});

});

function waitForAddedNode(params) {
    new MutationObserver(function(mutations) {
        var el = document.getElementById(params.id);
        if (el) {
            this.disconnect();
            params.done(el);
        }
    }).observe(params.parent || document, {
        subtree: !!params.recursive,
        childList: true,
    });
}

// Installer Report within call out
$(document).on('knack-view-render.view_2074', function(event, view) {
  $('#view_2074-field_1542').on('change',function() {
  	let outcome = $('#view_2074-field_1542').val()
    if (outcome.includes("Issues")) {
      document.getElementById('field_1545').value = "Call out completed without issues"
    } else {
      document.getElementById('field_1545').value = ""
    }
  })
})

// Installer Report from reporting page
$(document).on('knack-view-render.view_2077', function(event, view) {
  $('#view_2077-field_1542').on('change',function() {
  	let outcome = $('#view_2077-field_1542').val()
    if (outcome.includes("Issues")) {
      document.getElementById('field_1545').value = "Call out completed without issues"
    } else {
      document.getElementById('field_1545').value = ""
    }
  })
})

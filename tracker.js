const objects = {
  'callouts': 'object_78',
  'jobs': 'object_3',
  'installers': 'object_71',
  'invoices': 'object_19',
  'orders': 'object_5',
  'opportunities': 'object_17',
  'users': 'object_8',
  'contacts': 'object_13',
  'salespeople': 'object_82',
  'opspeople': 'object_68',
  'documents': 'object_22',
  'notes': 'object_53',
  'notesTypes': 'object_112',
  'developments': 'object_21',
  'jobStatuses': 'object_28',
  'leads': 'object_81',
  'activities':'object_114'
}

// -------------------------------------------------------
// Start Listener
$(document).on('knack-view-render.any', function(event, view, data) {


  // Add global listeners
  try {
    if (Knack.getUserAttributes() !== "No user found") {

      // Ensure all headers have been decrypted and are available
      if(!KnackObject.headers) KnackObject.init(getHeaders('Knack'))
      window.myJobRecHeaders = window.myJobRecHeaders || getHeaders('JobRec')
      window.calendarHeaders = window.calendarHeaders || getHeaders('Calendar')

      if (view.source) {
        if (view.source.object) {

          // Add listeners to everything for tracking
          let changeLogger = new KnackObject(view.source.object, view)
          changeLogger.onChange(logMixpanelRecordAction)

          // Add callout listeners
          if (view.source.object === objects.callouts) {
            let calloutsObj = new KnackObject(view.source.object, view)
            calloutsObj.onCreate(processNewCallOut)
            calloutsObj.onUpdate(processUpdatedCallOut)
            calloutsObj.onTouch(checkCallOutForMissingData)
            //calloutsObj.onDelete(processDeletedCallOut)
          }

          // Add job listeners
          if (view.source.object === objects.jobs) {
            let jobsObj = new KnackObject(view.source.object, view)
            jobsObj.onCreate(processNewJob)
            jobsObj.onUpdate(processUpdatedJob)
            //   jobsObj.onDelete(processDeletedJob)
          }

          // Add note listeners
          if (view.source.object === objects.notes) {
            let notesObj = new KnackObject(view.source.object, view)
            notesObj.onCreate(processNewNote)
          }

          // Add opportunity listeners
          if (view.source.object === objects.opportunities) {
            let opportunityObj = new KnackObject(view.source.object, view)
            opportunityObj.onChange(processOpportunityChange)
          }

          // Add order listeners
          if (view.source.object === objects.orders) {
            let ordersObj = new KnackObject(view.source.object, view)
            ordersObj.onChange(processOrderChange)
          }

          // Add invoice listeners
          if (view.source.object === objects.invoices) {
            let invoiceObj = new KnackObject(view.source.object, view)
            invoiceObj.onCreate(processNewInvoice)
            invoiceObj.onUpdate(processUpdatedInvoice)
            // invoiceObj.onDelete(processDeletedInvoice)
          }

          // Add lead listeners
          if (view.source.object === objects.leads) {
            let leadObj = new KnackObject(view.source.object, view)
            leadObj.onChange(processLeadChange)
          }

          // Add activity listeners
          if (view.source.object === objects.activities) {
            let activityObj = new KnackObject(view.source.object, view)
            activityObj.onChange(processActivityChange)
          }

        }
      }
    }
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

  // Change submit buttons to 'save'
  var $submitButtonArray = $(".kn-submit input[type=submit]");
  $submitButtonArray.each(function(index) {
    var $submitButton = $(this);
    if ($submitButton.attr("value") === "Submit") {
      $submitButton.attr("value", "Save");
    }
  });


})
// End Listner

$(document).on('knack-scene-render.any', function(event, scene) {

  try {
    logMixPanelPageLoad(scene) // Capture data
    $(".kn-back-link a").html("<i class='fa fa-chevron-circle-left'></i> Previous"); // Change back links
    addLinksToMainMenu()
    formatAddressInput()
  } catch (err) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }

})

function logMixPanelPageLoad(scene) {
  let user = Knack.getUserAttributes()
  let logData = {
    user: user.name || user,
    sceneName: scene.name,
    slug: scene.slug,
    url: `https://lovelight.knack.com/tracker#${scene.slug}`,
    release: window.release || '',
    installer: user.roles ? user.roles.includes('object_71') && !user.roles.includes('object_11') : false // Installer but not Staff
  }
  mixpanel.track(`Page Loaded`, logData)
}

function logMixpanelRecordAction({
  view,
  record,
  action,
  fields,
  changes
}) {

  let user = Knack.getUserAttributes()
  let slug = view.scene ? view.scene.slug : ''
  let scene_id = view.scene ? view.scene.scene_id : ''
  let name = view.name ? view.name : ''
  let changesNames = changes.map(fieldKey => {
    return fields[fieldKey] ? fields[fieldKey].name : undefined
  })

  let logData = {
    user: user.name || user,
    objectId: view.source.object,
    objectName: KnackObject.objects(view.source.object)[0].name,
    recordId: record.id,
    changesIds: changes,
    changesNames: changesNames,
    viewId: view.key,
    viewName: name,
    slug: slug,
    sceneId: scene_id,
    url: `https://lovelight.knack.com/tracker#${slug}/${scene_id}`,
    release: window.release || '',
    installer: user.roles ? user.roles.includes('object_71') && !user.roles.includes('object_11') : false // Installer but not Staff
  }
  mixpanel.track(`Record ${action.description}d`, logData)
}

//***************************************************************************
//******************* ADD LINKS TO MENU *************************************
//***************************************************************************

function addLinksToMainMenu() {

  // Logged in users who are staff...
  if (Knack.getUserRoles('object_11')) {

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
}

// Standard address input is confusing - lable position not clear, US terms
// This removes all labels and addes place holder text to fields instead.
function formatAddressInput() {
  $('.kn-input-address .control > label').remove()
  $('.kn-input-address .input[name="street"]').each((index, input) => {
    $(input)[0].placeholder = 'Street'
  })
  $('.kn-input-address .input[name="street2"]').each((index, input) => {
    $(input)[0].placeholder = 'Street'
  })
  $('.kn-input-address .input[name="city"]').each((index, input) => {
    $(input)[0].placeholder = 'Suburb'
  })
  $('.kn-input-address .input[name="state"]').each((index, input) => {
    $(input)[0].placeholder = 'State'
  })
  $('.kn-input-address .input[name="zip"]').each((index, input) => {
    $(input)[0].placeholder = 'Postcode'
  })
}

//***************************************************************************
//******************* HIDE EMPTY TABLES *************************************
//***************************************************************************

const hideEmptyTablePages = [
  'knack-scene-render.scene_703', //My Jobs https://lovelight.knack.com/tracker#my-jobs/
  'knack-scene-render.scene_720', //My Invoices https://lovelight.knack.com/tracker#my-invoices/
  'knack-scene-render.scene_417', //My To Quote dashboard ??
  'knack-scene-render.scene_707', // My Opportunities https://lovelight.knack.com/tracker#my-opportunities/
  'knack-scene-render.scene_1578', // My Jobs ??
  'knack-scene-render.scene_778', // My Jobs https://lovelight.knack.com/tracker#my-scheduling-jobs/my-jobs2/
  'knack-scene-render.scene_956', // My Remakes https://lovelight.knack.com/tracker#my-remakes/
  'knack-scene-render.scene_959', // Track Remakes https://lovelight.knack.com/tracker#my-remakes/track-remake/{}/
  //'knack-scene-render.scene_52', // View Job Details
]

$(document).on(hideEmptyTablePages.join(' '), function(event, scene) {
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
        })).catch(err => {
          if (typeof Sentry === 'undefined') throw err
          Sentry.captureException(err)
        }) // This needs work
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

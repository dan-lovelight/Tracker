const objects = {
  'callouts': 'object_78',
  'jobs': 'object_3',
  'installers': 'object_71',
  'invoices': 'object_19',
  'orders': 'object_19',
  'opportunities': 'object_17',
  'users' : 'object_8',
  'contacts': 'object_13',
  'salespeople': 'object_82',
  'opspeople': 'object_68',

}

$(document).on('knack-view-render.any', function(event, view, data) {

  // try {
  //   let callouts = new KnackObject('object_78', view)
  //   callouts.onCreate(function(view, record, user) {
  //     let data = {
  //       'field_1581': user.name
  //     }
  //     callouts.update(record.id, data)
  //   })
  //
  //   let monitor
  //   let user = Knack.getUserAttributes()
  //   let url = 'https://lovelight.knack.com/tracker#'
  //
  //   if (view.source) {
  //     if (view.source.object) {
  //       monitor = new KnackObject(view.source.object, view)
  //       monitor.onUpdate(updateHandler)
  //       monitor.onCreate(createHandler)
  //       monitor.onDelete(deleteHandler)
  //     }
  //   }
  //
  //   function updateHandler(view, record, action, fields, previousRecord, changes) {
  //     try {
  //
  //       let chgString = ''
  //       let slug = view.scene.slug || ''
  //       let scene_id = view.scene.scene_id || ''
  //
  //       for (let i = 0; i < changes.length; i++) {
  //
  //         let fieldKey = changes[i]
  //         let fieldKeyRaw = fieldKey + '_raw'
  //         let from = previousRecord[fieldKey]
  //         let to = record[fieldKey]
  //
  //         chgString += `> _${monitor.fields[fieldKey].name}_ ` // name of the field
  //
  //         if (monitor.fields[fieldKey].type === 'connection') {
  //
  //           from = ''
  //           if (previousRecord[fieldKeyRaw]) {
  //             if (previousRecord[fieldKeyRaw].length > 0) {
  //               for (j = 0; j < previousRecord[fieldKeyRaw].length; j++) {
  //                 from += previousRecord[fieldKeyRaw][j].identifier
  //                 if (j !== (record[fieldKeyRaw].length - 1)) from += ','
  //               }
  //             }
  //           }
  //
  //           to = ''
  //           if (record[fieldKeyRaw]) {
  //             if (record[fieldKeyRaw].length > 0) {
  //               for (k = 0; k < record[fieldKeyRaw].length; k++) {
  //                 to += record[fieldKeyRaw][k].identifier
  //                 if (k !== (record[fieldKeyRaw].length - 1)) to += ','
  //               }
  //             }
  //           }
  //
  //           chgString += `(from \`${from}\` to \`${to}\`)`
  //
  //         } else {
  //           // not a connection field
  //           chgString += `(from \`${previousRecord[fieldKey]}\` to \`${record[fieldKey]}\`)`
  //         }
  //
  //         if (i !== (changes.length - 1)) chgString += '\n' // add a new line and repeat for next change
  //
  //       }
  //       let msg = `*${user.name}* just updated a <${url}${slug}/${scene_id}|*${monitor.nameSingular}*> via ${view.key} '${view.name}': \n${chgString}`
  //       updateLog(msg)
  //     } catch (error) {
  //       updateLog(`KnackObject error: \`\`\`${user}\n${view.key}\n${error.message}\n${error.stack}\`\`\``)
  //     }
  //   }
  //
  //   function createHandler(view, record) {
  //     let slug = view.scene ? view.scene.slug : ''
  //     let scene_id = view.scene ? view.scene.scene_id : ''
  //     let name = view.name ? view.name : view.key
  //     let msg = `*${user.name}* just created a <${url}${slug}/${scene_id}|*${monitor.nameSingular}*> via ${view.key} '${name}' (record has ${Object.keys(record).length} fields)`
  //     updateLog(msg)
  //   }
  //
  //   function deleteHandler(view, record) {
  //     let slug = view.scene.slug || ''
  //     let scene_id = view.scene.scene_id || ''
  //     let msg = `*${user.name}* just deleted a <${url}${slug}/${scene_id}|*${monitor.nameSingular}*> via ${view.key} '${view.name}' (record has ${Object.keys(record).length} fields)`
  //     updateLog(msg)
  //   }
  //
  // } catch (error) {
  //   updateLog(`KnackObject error: \`\`\`${error.message}\n${error.stack}\`\`\``)
  // }

  var $submitButtonArray = $(".kn-submit input[type=submit]");
  $submitButtonArray.each(function(index) {
    var $submitButton = $(this);
    if ($submitButton.attr("value") === "Submit") {
      $submitButton.attr("value", "Save");
    }
  });
});

$(document).on('knack-view-render.any', function(event, view, data) {
  try {
    let changeLogger
    let user = Knack.getUserAttributes()
    let url = 'https://lovelight.knack.com/tracker#'
    if (view.source) {
      if (view.source.object) {
        changeLogger = new KnackObject(view.source.object, view)
        changeLogger.onChange(logMixpanelRecordAction)
      }
    }
  } catch (error) {
    updateLog(`Logging error: \`\`\`${error.message}\n${error.stack}\`\`\``)
  }
})

$(document).on('knack-scene-render.any', function(event, scene) {
  logMixPanelPageLoad(scene)
})

function logMixPanelPageLoad(scene){

  let logData = {
    user: Knack.getUserAttributes().name,
    sceneName: scene.name,
    slug: scene.slug,
    url: `https://lovelight.knack.com/tracker#${scene.slug}`
  }
  mixpanel.track(`Page Loaded`, logData)
}

function logMixpanelRecordAction(view, record, action, fields, recordBefore, changes) {

    let slug = view.scene ? view.scene.slug : ''
    let scene_id = view.scene ? view.scene.scene_id : ''
    let name = view.name ? view.name : ''
    let changesNames = changes.map(fieldKey => {
      return fields[fieldKey].name
    })

    let logData = {
      user: Knack.getUserAttributes().name,
      objectId: view.source.object,
      objectName: KnackObject.objects(view.source.object)[0].name,
      recordId: record.id,
      changesIds: changes,
      changesNames: changesNames,
      viewId: view.key,
      viewName: name,
      slug: slug,
      sceneId: scene_id,
      url: `https://lovelight.knack.com/tracker#${slug}/${scene_id}`
    }
    mixpanel.track(`Record ${action}d`, logData)
}

$(document).on('knack-scene-render.any', function(event, scene) {
  $(".kn-back-link a").html("<i class='fa fa-chevron-circle-left'></i> Previous");
});


//***************************************************************************
//******************* ADD LINKS TO MENU *************************************
//***************************************************************************

$(document).on('knack-scene-render.any', function(event, scene) {

  let userRoles = Knack.getUserRoles()

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

  //Change the way address input fields dispaly
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

});

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
  'knack-scene-render.scene_52', // View Job Details
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
        })).catch(logError(hopeItDoesntBreak, arguments, err, Knack.getUserAttributes(), window.location.href, true)) // This needs work
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
//******************* UPDATE OPPORTUNITIES ********************
//***************************************************************************



// $(document).on('knack-scene-render.scene_509', function(event, scene) {
//
//   //  const target = document.getElementById('view_2057');
//   //  const options = {
//   //    attributes: true,
//   //    attributeOldValue: true,
//   //  };
//   //  const observer = new MutationObserver(callback);
//
//   //  function callback (mutations) {
//
//   //   mutations.forEach((mutation) => {
//   //		console.log(mutation)
//   //    })
//   //  }
//
//   //  observer.observe(target, options);
//
//   waitForAddedNode({
//     id: 'view_2057',
//     parent: document.querySelector('.container'),
//     recursive: false,
//     done: function(el) {
//       console.log(el);
//     }
//   });
//
// });
//
// function waitForAddedNode(params) {
//   new MutationObserver(function(mutations) {
//     var el = document.getElementById(params.id);
//     if (el) {
//       this.disconnect();
//       params.done(el);
//     }
//   }).observe(params.parent || document, {
//     subtree: !!params.recursive,
//     childList: true,
//   });
// }
//
// // Installer Report within call out
// $(document).on('knack-view-render.view_2074', function(event, view) {
//   $('#view_2074-field_1542').on('change', function() {
//     let outcome = $('#view_2074-field_1542').val()
//     if (outcome.includes("Issues")) {
//       document.getElementById('field_1545').value = "Call out completed without issues"
//     } else {
//       document.getElementById('field_1545').value = ""
//     }
//   })
// })
//
// // Installer Report from reporting page
// $(document).on('knack-view-render.view_2077', function(event, view) {
//   $('#view_2077-field_1542').on('change', function() {
//     let outcome = $('#view_2077-field_1542').val()
//     if (outcome.includes("Issues")) {
//       document.getElementById('field_1545').value = "Call out completed without issues"
//     } else {
//       document.getElementById('field_1545').value = ""
//     }
//   })
// })

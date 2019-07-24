// The Ops Dashboard lists all jobs and their status
// The tables on the page are a mix of job, callout and order records depending on the most relvnat info at each status
// This code removes duplicates from tables and handles mis-matched statuses between records
$(document).on('knack-scene-render.scene_713', function(event, scene) {
  // The code below relies on multiple views being loaded and so needs to run on scene render

  // ------------- Book for Measure Logic --------------//

  const scheduledMeasures = JSON.parse(JSON.stringify(Knack.views.view_2234.model.data.models))
  const completedMeasures = JSON.parse(JSON.stringify(Knack.views.view_2235.model.data.models))
  const jobsReadyToMeasure = JSON.parse(JSON.stringify(Knack.views.view_2220.model.data.models))

  // It's possible to have more than one callout in the table for a single job
  let uniqueCompletedMeasures = new Set()
  let duplicateCompletedMeasures = new Set()

  // Loop through all completed measures, identify dupes, and add to correct array
  for(let i = 0; i < completedMeasures.length; i++){
    let thisJobId = completedMeasures[i].field_928_raw[0].id
    let measuresForThisJob = completedMeasures.filter(callout => thisJobId === callout.field_928_raw[0].id)
    // If there were multiples, add to the appropriate array
    if(measuresForThisJob.length>1){
      let d1 = Date.parse(measuresForThisJob[0].field_939.date)
      let d2 = Date.parse(measuresForThisJob[1].field_939.date)
      if(d1>d2){
        uniqueCompletedMeasures.add(measuresForThisJob[0])
        duplicateCompletedMeasures.add(measuresForThisJob[1])
      } else {
        uniqueCompletedMeasures.add(measuresForThisJob[1])
        duplicateCompletedMeasures.add(measuresForThisJob[0])
      }
    } else { // Only one, add to unique array
      uniqueCompletedMeasures.add(measuresForThisJob[0])
    }
  }

  uniqueCompletedMeasures = Array.from(uniqueCompletedMeasures)
  duplicateCompletedMeasures = Array.from(duplicateCompletedMeasures)

  const successfullyMeasured = uniqueCompletedMeasures.filter(callout => callout.field_1542.indexOf('No Issues') > -1)
  const unsuccessfullyMeasured = uniqueCompletedMeasures.filter(callout => callout.field_1542.indexOf('Follow') > -1)
  const unreportedMeasures = uniqueCompletedMeasures.filter(callout => callout.field_1542.length === 0)
  const successfullyAndUnreportedMeasures = successfullyMeasured.concat(unreportedMeasures)

  const scheduledForMeasureJobIds = scheduledMeasures.map(callout => callout.field_928_raw[0].id)
  const successfullyMeasuredJobIds = successfullyAndUnreportedMeasures.map(callout => callout.field_928_raw[0].id)
  const jobsIdsBookedForOrAlreadyMeasured = scheduledForMeasureJobIds.concat(successfullyMeasuredJobIds)

  const jobsToHideFromBookForMeasureTable = jobsReadyToMeasure.filter(job => jobsIdsBookedForOrAlreadyMeasured.includes(job.id))
  jobsToHideFromBookForMeasureTable.forEach(job => document.getElementById(job.id).remove())

  const duplicateCallOutIdsToHideFromMeasuredTable = duplicateCompletedMeasures.map(callout => callout.id)
  duplicateCallOutIdsToHideFromMeasuredTable.forEach(callout => document.getElementById(callout).remove())

  // Add notification to jobs in book for status that have unsuccessful installs
  unsuccessfullyMeasured.forEach(callout =>{
    let $job = $('#'+callout.field_928_raw[0].id)
    if ($job.length>0){
        let notification = `Measure on ${callout.field_939} requires follow up`
        $job.find('.col-1').append(`<div class="ZDBadge ZDNotification">${notification}</div>`)
    }
  })

  // -------------End Book for Measure Logic --------------//

  // -------------Book for Install Logic --------------//

  const scheduledInstalls = JSON.parse(JSON.stringify(Knack.views.view_2237.model.data.models))
  const completedInstalls = JSON.parse(JSON.stringify(Knack.views.view_2238.model.data.models))
  const jobsReadyToInstall = JSON.parse(JSON.stringify(Knack.views.view_2231.model.data.models)).concat(JSON.parse(JSON.stringify(Knack.views.view_2230.model.data.models))) //Book for and return visit tables

  let uniqueCompletedInstalls = new Set()
  let duplicateCompletedInstalls = new Set()

  // Loop through all completed installs, identify dupes, and add to correct array
  for(let i = 0; i < completedInstalls.length; i++){
    let thisJobId = completedInstalls[i].field_928_raw[0].id
    let installsForThisJob = completedInstalls.filter(callout => thisJobId === callout.field_928_raw[0].id)
    // If there were multiples, add to the appropriate array
    if(installsForThisJob.length>1){
      let d1 = moment(installsForThisJob[0].field_939,"DD/MM/YYYY")
      let d2 = moment(installsForThisJob[1].field_939,"DD/MM/YYYY")
      if(d1>d2){
        uniqueCompletedInstalls.add(installsForThisJob[0])
        duplicateCompletedInstalls.add(installsForThisJob[1])
      } else {
        uniqueCompletedInstalls.add(installsForThisJob[1])
        duplicateCompletedInstalls.add(installsForThisJob[0])
      }
    } else { // Only one, add to unique array
      uniqueCompletedInstalls.add(installsForThisJob[0])
    }
  }

  uniqueCompletedInstalls = Array.from(uniqueCompletedInstalls)
  duplicateCompletedInstalls = Array.from(duplicateCompletedInstalls)

  // Get completed installs by their report status
  const successfullyInstalled = uniqueCompletedInstalls.filter(callout => callout.field_1542.indexOf('No Issues') > -1)
  const unsuccessfullyInstalled = uniqueCompletedInstalls.filter(callout => callout.field_1542.indexOf('Follow') > -1)
  const unreportedInstalls = uniqueCompletedInstalls.filter(callout => callout.field_1542.length === 0)
  const successfullyAndUnreportedInstalls = successfullyInstalled.concat(unreportedInstalls)

  // Get ids of jobs that are scheduled for install, or succesfully installed, based on callouts
  const scheduledForInstallJobIds = scheduledInstalls.map(callout => callout.field_928_raw[0].id)
  const successfullyInstalledJobIds = successfullyAndUnreportedInstalls.map(callout => callout.field_928_raw[0].id)
  const jobsIdsBookedForOrAlreadyInstalled = scheduledForInstallJobIds.concat(successfullyInstalledJobIds)

  // Hide jobs in the book for table that have bookings or succsfully installs
  const jobsToHideFromBookForInstallTable = jobsReadyToInstall.filter(job => jobsIdsBookedForOrAlreadyInstalled.includes(job.id))
  jobsToHideFromBookForInstallTable.forEach(job => document.getElementById(job.id).remove())

  // Hide duplicate callouts from the installed table
  const duplicateCallOutIdsToHideFromInstallTable = duplicateCompletedInstalls.map(callout => callout.id)
  duplicateCallOutIdsToHideFromInstallTable.forEach(callout => document.getElementById(callout).remove())

  // Hide completed installs if there's another one already scheduled
  uniqueCompletedInstalls.forEach(callout => {
    if(scheduledForInstallJobIds.includes(callout.field_928_raw[0].id)){
      let calloutRow = document.getElementById(callout.id)
      if(calloutRow) calloutRow.remove()
    }
  })

  // Add notification to jobs in book for status that have unsuccessful installs
  unsuccessfullyInstalled.forEach(callout =>{
    let $job = $('#'+callout.field_928_raw[0].id)
    if ($job.length>0){
        let notification = `Install on ${callout.field_939} requires follow up`
        $job.find('.col-1').append(`<div class="ZDBadge ZDNotification">${notification}</div>`)
    }
  })

  removeUnusedTableGroups() // removing items from tables can orphan a grouping heading
  hideEmptyTables(scene)
})

// This removes any items from the 'measured' callouts table that have already been ordered
// This is determined by looking for 'measure' in talbe in the column that shows job status
// This column is hidden in the UI natively via Knack
$(document).on('knack-view-render.view_2235', function(event, view, data) {
  data.forEach(record => {
    if (record['field_928.field_245'].indexOf('Measure') === -1) {
      let calloutRow = document.getElementById(record.id)
      if(calloutRow) calloutRow.remove()
    }
  })
})

// This removes any items from the 'installed' callouts table that have already been ordered
// This is determined by looking for 'installed' in table in the column that shows job status
// This column is hidden in the UI natively via Knack
$(document).on('knack-view-render.view_2238', function(event, view, data) {
  data.forEach(record => {
    if (record['field_928.field_245'].indexOf('Complete') > -1) {
      let calloutRow = document.getElementById(record.id)
      if(calloutRow) calloutRow.remove()
    }
  })
})

function removeUnusedTableGroups() {
  let group = document.getElementsByClassName('kn-group-level-1')
  for (i = 0; i < group.length; i++) {
    if (!group[i].nextElementSibling) {
      group[i].remove()
    } else if (group[i].nextElementSibling.classList) {
      if (group[i].nextElementSibling.classList.contains('kn-group-level-1')) {
        group[i].remove()
      }
    }
  }
}

// CUSTOM OPPORTUNITIES
// Add open/pending badges to opportunities in 'To Quote' status
$(document).on('knack-view-render.view_1038 knack-view-render.view_1564', function(event, view, data) {
  data.forEach(record => {
    if (record['field_1606'].indexOf('Open') > -1) {
      let $openQuote = $('#' + record.id)
      $openQuote.find('.col-1').prepend('<div class="ZDBadge ZDOpen">O</div>')
    }
    if (record['field_1606'].indexOf('Pending') > -1) {
      let $pendingQuote = $('#' + record.id)
      $pendingQuote.find('.col-1').prepend('<div class="ZDBadge ZDPending">P</div>')
    }
  })
})

// Send For Review form loaded
// Update the review field to the sales person
$(document).on('knack-view-render.view_1024', async function(event, view, data) {
  Knack.showSpinner()
  try {
    let opportunity = await getRecordPromise(view.scene.object, view.scene.scene_id)
    if (opportunity.field_1274_raw.length > 0) {
      $reviewer = $('#' + view.key + '-field_830')
      let salesPerson = await getRecordPromise('object_82', opportunity.field_1274_raw[0].id)
      $reviewer.html(`<option value='${salesPerson.id}'>${salesPerson.field_956}</option>`).trigger('liszt:updated')
    }
  } catch (error) {
    updateLog(`Send for review error: \`\`\`${error.message}\n${error.stack}\`\`\``)
  }
  Knack.hideSpinner()
})

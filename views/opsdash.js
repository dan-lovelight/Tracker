// The Ops Dashboard lists all jobs and their status
// The tables on the page are a mix of job, callout and order records depending on the most relvnat info at each status
// This code removes duplicates from tables and handles mis-matched statuses between records
$(document).on('knack-scene-render.scene_713', function(event, scene) {
  // The code below relies on multiple views being loaded and so needs to run on scene render

  // Hide summary count on all tables.
  $('.kn-entries-summary').hide()

  // ------------- Book for Measure Logic --------------//

  const jobsReadyToMeasure = JSON.parse(JSON.stringify(Knack.views.view_2220.model.data.models)) // Book For Measure (jobs)
  const scheduledMeasures = JSON.parse(JSON.stringify(Knack.views.view_2234.model.data.models)) // Measure Booked (callouts)
  const completeCalloutMeasures = JSON.parse(JSON.stringify(Knack.views.view_2235.model.data.models)) // Measured (callouts)
  const completeJobMeasures = JSON.parse(JSON.stringify(Knack.views.view_2326.model.data.models)) // Measured (jobs)

  // It's possible to have more than one callout in the table for a single job
  let uniqueCompletedMeasures = new Set()
  let duplicateCompletedMeasures = new Set()

  // Loop through all completed measures, identify dupes, and add to correct array
  for (let i = 0; i < completeCalloutMeasures.length; i++) {
    // Get jobId from callout record
    let thisJobId = completeCalloutMeasures[i].field_928_raw[0].id
    // Get all completed measure callouts for this job
    let measuresForThisJob = completeCalloutMeasures.filter(callout => thisJobId === callout.field_928_raw[0].id)
    // If there were multiples, separate out duplicates (by date)
    if (measuresForThisJob.length > 1) {

      //***** this logic needs work, only works for two items ****//
      let d1 = Date.parse(measuresForThisJob[0].field_939.date)
      let d2 = Date.parse(measuresForThisJob[1].field_939.date)
      if (d1 > d2) {
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

  // Convert sets to arrays
  uniqueCompletedMeasures = Array.from(uniqueCompletedMeasures)
  duplicateCompletedMeasures = Array.from(duplicateCompletedMeasures)

  // Build arrays of callouts based on their report status
  const successfullyMeasured = uniqueCompletedMeasures.filter(callout => callout.field_1542.indexOf('No Issues') > -1)
  const unsuccessfullyMeasured = uniqueCompletedMeasures.filter(callout => callout.field_1542.indexOf('Follow') > -1)
  const unreportedMeasures = uniqueCompletedMeasures.filter(callout => callout.field_1542.length === 0)
  const successfullyAndUnreportedMeasures = successfullyMeasured.concat(unreportedMeasures)

  // Build arrays of job ids for measure callouts
  const scheduledForMeasureJobIds = scheduledMeasures.map(callout => callout.field_928_raw[0].id)
  const successfullyMeasuredJobIds = successfullyAndUnreportedMeasures.map(callout => callout.field_928_raw[0].id)
  const jobsIdsBookedForOrAlreadyMeasured = scheduledForMeasureJobIds.concat(successfullyMeasuredJobIds)

  // Get array of jobs that are in the book for measure table, that are actually measured or scheduled
  const jobsToHideFromBookForMeasureTable = jobsReadyToMeasure.filter(job => jobsIdsBookedForOrAlreadyMeasured.includes(job.id))
  // Hide these jobs
  if (jobsToHideFromBookForMeasureTable) jobsToHideFromBookForMeasureTable.forEach(job => {
    if (document.getElementById(job.id)) document.getElementById(job.id).remove()
  })

  // Get an array of callout ids for jobs with duplicate callouts in the measured table
  const duplicateCallOutIdsToHideFromMeasuredTable = duplicateCompletedMeasures.map(callout => callout.id)
  // Hide these callouts
  if (duplicateCallOutIdsToHideFromMeasuredTable) duplicateCallOutIdsToHideFromMeasuredTable.forEach(callout => {
    if (document.getElementById(callout)) document.getElementById(callout).remove()
  })

  // Get an array of job ids for all uniquly represented jobs
  const uniqueCompletedMeasureJobIds = uniqueCompletedMeasures.map(callout => callout.field_928_raw[0].id)
  // Check if Measured jobs in the job table are also in the measured callouts table. If so, hide them
  if (completeJobMeasures) completeJobMeasures.forEach(job => {
    if (uniqueCompletedMeasureJobIds.includes(job.id)) $('#view_2326 #' + job.id).remove()
  })

  // Add notification to jobs in book for status that have unsuccessful installs
  unsuccessfullyMeasured.forEach(callout => {
    let $job = $('#' + callout.field_928_raw[0].id)
    if ($job.length > 0) {
      let notification = `Measure on ${callout.field_939} requires follow up`
      $job.find('.col-1').append(`<div class="ZDBadge ZDNotification">${notification}</div>`)
    }
  })

  // -------------End Book for Measure Logic --------------//

  // -------------Book for Install Logic --------------//

  const scheduledInstalls = JSON.parse(JSON.stringify(Knack.views.view_2237.model.data.models)) // Install Booked (callouts)
  const completeCalloutInstalls = JSON.parse(JSON.stringify(Knack.views.view_2238.model.data.models)) // Installed (callouts)
  const jobsReadyToInstall = JSON.parse(JSON.stringify(Knack.views.view_2231.model.data.models)) //Book for Install (Jobs)
  jobsReadyToInstall.concat(JSON.parse(JSON.stringify(Knack.views.view_2230.model.data.models))) // Return Visit required (Jobs)
  const completeJobInstalls = JSON.parse(JSON.stringify(Knack.views.view_2327.model.data.models)) // Installed (jobs)
  const orderedJobs = JSON.parse(JSON.stringify(Knack.views.view_2239.model.data.models)) // Installed (jobs)

  let uniqueCompletedInstalls = new Set()
  let duplicateCompletedInstalls = new Set()

  // Loop through all completed installs, identify dupes, and add to correct array
  for (let i = 0; i < completeCalloutInstalls.length; i++) {
    let thisJobId = completeCalloutInstalls[i].field_928_raw[0].id
    let installsForThisJob = completeCalloutInstalls.filter(callout => thisJobId === callout.field_928_raw[0].id)
    // If there were multiples, add to the appropriate array
    if (installsForThisJob.length > 1) {
      let d1 = moment(installsForThisJob[0].field_939, "DD/MM/YYYY")
      let d2 = moment(installsForThisJob[1].field_939, "DD/MM/YYYY")
      if (d1 > d2) {
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
  if (jobsToHideFromBookForInstallTable) jobsToHideFromBookForInstallTable.forEach(job => {
    if (document.getElementById(job.id)) document.getElementById(job.id).remove()
  })

  // Hide duplicate callouts from the installed table
  const duplicateCallOutIdsToHideFromInstallTable = duplicateCompletedInstalls.map(callout => callout.id)
  if (duplicateCallOutIdsToHideFromInstallTable) duplicateCallOutIdsToHideFromInstallTable.forEach(callout => {
    if (document.getElementById(callout)) document.getElementById(callout).remove()
  })

  // Get an array of job ids for all uniquly represented installed jobs
  const uniqueCompletedInstallJobIds = uniqueCompletedInstalls.map(callout => callout.field_928_raw[0].id)

  // Check if installed jobs in the job table are also in the installed callouts table. If so, hide them
  if (completeJobInstalls) completeJobInstalls.forEach(job => {
    if (uniqueCompletedInstallJobIds.includes(job.id)) $('#view_2327 #' + job.id).remove()
  })

  // get a list of job ids in ordered status
  const orderedJobIds = orderedJobs.map(job => job.id)

  // Hide installed jobs if they've been moved back to ordered status
  uniqueCompletedInstalls.forEach(callout =>  {
    if(orderedJobIds.includes(callout.field_928_raw[0].id)){
      let calloutRow = document.getElementById(callout.id)
      if (calloutRow) calloutRow.remove()
    }
  })

  // Hide completed installs if there's another one already scheduled
  uniqueCompletedInstalls.forEach(callout => {
    if (scheduledForInstallJobIds.includes(callout.field_928_raw[0].id)) {
      let calloutRow = document.getElementById(callout.id)
      if (calloutRow) calloutRow.remove()
    }
  })

  // Add notification to jobs in book for status that have unsuccessful installs
  unsuccessfullyInstalled.forEach(callout => {
    let $job = $('#' + callout.field_928_raw[0].id)
    if ($job.length > 0) {
      let notification = `Install on ${callout.field_939} requires follow up`
      $job.find('.col-1').append(`<div class="ZDBadge ZDNotification">${notification}</div>`)
    }
  })

  removeUnusedTableGroups() // removing items from tables can orphan a grouping heading
  removeUnusedTables(scene)
  hideEmptyTables(scene)
})

// This removes any items from the 'measured' callouts table that have already been ordered
// This is determined by looking for 'measure' in talbe in the column that shows job status
// This column is hidden in the UI natively via Knack
$(document).on('knack-view-render.view_2235', function(event, view, data) {
  data.forEach(record => {
    if (record['field_928.field_245'] && record['field_928.field_245'].indexOf('Measure') === -1) {
      let calloutRow = document.getElementById(record.id)
      if (calloutRow) calloutRow.remove()
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
      if (calloutRow) calloutRow.remove()
    }
  })
})

function removeUnusedTableGroups() {
  const group = document.getElementsByClassName('kn-group-level-1')
  for (i = 0; i < group.length; i++) {
    if (!group[i].nextElementSibling || group[i].nextElementSibling.classList.contains('kn-group-level-1')) {
      group[i].setAttribute('style', 'display:none')
    }
  }
}

function removeUnusedTables(scene) {
  //Iterate throught each view in the page
  scene.views.map(function(view) {
    if (view.type === 'table' && Knack.models[view.key]) {
      // If there are no rows with ids, remove the table
      // We've already removed any unnecessary rows from the DOM so there could be nothing left
      if ($('#' + view.key).find('tr[id]').length === 0) $('#' + view.key).remove()
    }
  })
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
$(document).on('knack-view-render.view_1024', async function(event, view, record) {
  Knack.showSpinner()
  try {
    if (record.field_1274_raw.length > 0) {
      let $options = $('#' + view.key + '-field_830 option')
      let reviewerOption = $('#' + view.key + '-field_830 ' + `option:contains(${record.field_1274_raw[0].identifier})`)[0].outerHTML
      let $reviewer = $('#' + view.key + '-field_830')
      $reviewer.html(reviewerOption).trigger('liszt:updated')
    }
  } catch (error) {
    if (typeof Sentry === 'undefined') throw err
    Sentry.captureException(err)
  }
  Knack.hideSpinner()
})

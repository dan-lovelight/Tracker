// The Ops Dashboard lists all jobs and their status
// The tables on the page are a mix of job, callout and order records depending on the most relvnat info at each status
// This code removes duplicates from tables and handles mis-matched statuses between records
$(document).on('knack-scene-render.scene_713', function(event, scene) {
  // The code below relies on multiple views being loaded and so needs to run on scene render

  // Get an array of job names scheduled for measure
  let scheduledMeasures = JSON.parse(JSON.stringify(Knack.views.view_2234.model.data.models))
  scheduledMeasures = scheduledMeasures.map(callout => callout.field_928_raw[0].identifier)

  // Get an array of job names that have been measured without issues
  let completeMeasures = JSON.parse(JSON.stringify(Knack.views.view_2235.model.data.models))
  completeMeasures = completeMeasures.filter(callout => callout.field_1542.indexOf('No Issues') > -1)
  completeMeasures = completeMeasures.map(callout => callout.field_928_raw[0].identifier)

  // Get an array of all jobs currently in 'book for measure' or 'measure booked' status
  let jobsToMeasure = JSON.parse(JSON.stringify(Knack.views.view_2220.model.data.models))

  // Get an array of jobs that are measured or booked for measure, according to callouts
  let jobsToHide = jobsToMeasure.filter(job => {
    return scheduledMeasures.includes(job.field_296_raw) || completeMeasures.includes(job.field_296_raw)
  })
  // Remove jobs
  jobsToHide.forEach(job => {
    document.getElementById(job.id).remove()
  })

  // Get an array of job names that have been scheduled for install
  // 'Install Booked' table showing callouts
  let scheduledInstalls = JSON.parse(JSON.stringify(Knack.views.view_2237.model.data.models))
  scheduledInstalls = scheduledInstalls.map(callout => callout.field_928_raw[0].identifier)

  // Get an array of job names that have been installed without issues
  // 'Installed' table of call outs
  let completeInstalls = JSON.parse(JSON.stringify(Knack.views.view_2238.model.data.models))
  completeInstalls = completeInstalls.filter(callout => callout.field_1542.indexOf('Follow Up') === -1)
  completeInstalls = completeInstalls.map(callout => callout.field_928_raw[0].identifier)

  // Get an array of all jobs currently in 'book for install' or 'install booked' status
  // 'Book For Install' table of Jobs
  let jobsToInstall = JSON.parse(JSON.stringify(Knack.views.view_2231.model.data.models))

  // Get an array of jobs that are installed or booked for install according to callouts
  jobsToHide = jobsToInstall.filter(job => {
    return scheduledInstalls.includes(job.field_296_raw) || completeInstalls.includes(job.field_296_raw)
  })
  jobsToHide.forEach(job => {
    document.getElementById(job.id).remove()
  })

  // Get an array of job names that have been installed without issues
  // 'Installed' table of call outs
  let jobsRequiringFollowUp = JSON.parse(JSON.stringify(Knack.views.view_2238.model.data.models))
  jobsRequiringFollowUp = completeInstalls.filter(callout => callout.field_1542.indexOf('Follow Up') > -1)


  removeUnusedTableGroups() // removing items from tables can orphan a grouping heading
  hideEmptyTables(scene)
})

// This removes any items from the 'measured' callouts table that have already been ordered
// This is determined by looking for 'measure' in talbe in the column that shows job status
// This column is hidden in the UI natively via Knack
$(document).on('knack-view-render.view_2235', function(event, view, data) {
  data.forEach(record => {
    if (record['field_928.field_245'].indexOf('Measure') === -1) {
      document.getElementById(record.id).remove()
    }
  })
})

// This removes any items from the 'installed' callouts table that have already been ordered
// This is determined by looking for 'installed' in table in the column that shows job status
// This column is hidden in the UI natively via Knack
$(document).on('knack-view-render.view_2238', function(event, view, data) {
  data.forEach(record => {
    if (record['field_928.field_245'].indexOf('Complete') > -1) {
      document.getElementById(record.id).remove()
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

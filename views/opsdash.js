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
  let scheduledInstalls = JSON.parse(JSON.stringify(Knack.views.view_2237.model.data.models))
  scheduledInstalls = scheduledInstalls.map(callout => callout.field_928_raw[0].identifier)

  // Get an array of job names that have been measured without issues
  let completeInstalls = JSON.parse(JSON.stringify(Knack.views.view_2238.model.data.models))
  completeInstalls = completeInstalls.filter(callout => callout.field_1542.indexOf('No Issues') > -1)
  completeInstalls = completeInstalls.map(callout => callout.field_928_raw[0].identifier)

  // Get an array of all jobs currently in 'book for install' or 'install booked' status
  let jobsToInstall = JSON.parse(JSON.stringify(Knack.views.view_2231.model.data.models))

  // Get an array of jobs that are installed or booked for install according to callouts
  jobsToHide = jobsToInstall.filter(job => {
    return scheduledInstalls.includes(job.field_296_raw) || completeInstalls.includes(job.field_296_raw)
  })
  jobsToHide.forEach(job => {
    document.getElementById(job.id).remove()
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

const jobCreatedEvents = [
  'knack-record-create.view_33', // #dashboard/jobs2/add-job/, #pages/scene_18/views/view_33
  'knack-record-create.view_609', // #jobs/view-job-details, #pages/scene_244/views/view_609
  'knack-record-create.view_1671', // #custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity2, #pages/scene_776/views/view_1671
  'knack-record-create.view_1670' // #custom-opportunities/view-opportunity-details/xxx/add-job-to-opportunity, #pages/scene_776/views/view_1670
]
const jobUpdatedEvents = [
  'knack-form-submit.view_277', // #dashboard/jobs2/, #pages/scene_247/views/view_277
  'knack-cell-update.view_402', // #dashboard/jobs2/, #pages/scene_247/views/view_402
  'knack-cell-update.view_277', // #dashboard/jobs2/, #pages/scene_247/views/view_277
]

// Job record created
$(document).on(jobCreatedEvents.join(' '), function(event, view, record) {
  addJobToJobRec(record)
});

//******************** CREATE JOB IN JOBREC ********************************

function addJobToJobRec(job) {
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

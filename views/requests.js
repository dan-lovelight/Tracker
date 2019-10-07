// The Ops Dashboard lists all callout requests, and jobs that are in book for status
// This code removes jobs that are already represented by callout requests
$(document).on('knack-scene-render.scene_203', function(event, scene) {
  // The code below relies on multiple views being loaded and so needs to run on scene render

  // Hide summary count on all tables.
  $('.kn-entries-summary').hide()

  // ------------- Book for Measure Logic --------------//

  const serviceRequests = JSON.parse(JSON.stringify(Knack.views.view_2302.model.data.models)) // Requested Service Calls
  const measureRequests = JSON.parse(JSON.stringify(Knack.views.view_2363.model.data.models)) // Requested Measures
  const installRequests = JSON.parse(JSON.stringify(Knack.views.view_2163.model.data.models)) // Requested Installs

  // It's possible to have more than one callout in the table for a single job
  let uniqueCallouts = new Set()

  serviceRequests.forEach(request => {
    let jobs = request.field_928_raw
    jobs.forEach(job => uniqueCallouts.add(job.id))
  })

  measureRequests.forEach(request => {
    let jobs = request.field_928_raw
    jobs.forEach(job => uniqueCallouts.add(job.id))
  })

  installRequests.forEach(request => {
    let jobs = request.field_928_raw
    jobs.forEach(job => uniqueCallouts.add(job.id))
  })

  let requestedJobIds = Array.from(uniqueCallouts)

  requestedJobIds.forEach(id =>{
    if ($(`tr[id='${id}']`).length>0) $(`tr[id='${id}']`).remove()
  })

})

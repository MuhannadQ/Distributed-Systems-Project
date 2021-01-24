$(document).ready(function() {

  let departureCity = undefined;
  //let fromCityDiv = $("#from-city-request");
  let i = 0;
  
  let fromCityDiv = $("#stop-0");
  $("#add-stop").click(function(e) {
    i++;
    //const index = i.toString();
    let viaCityDiv = fromCityDiv.clone()
    viaCityDiv.insertAfter(`#stop-${i-1}`);
    viaCityDiv.find( "option[disabled]" ).text(`Via "City"`);
    // viaCityDiv.find("select").attr("name", `stops[${i}][city]`);
    // viaCityDiv.find("input").attr("name", `stops[${i}][date]`);
    viaCityDiv.attr("id", `stop-${i}`);
  });

  // $("#offer-form").submit(function() {
  //   //e.preventDefault();
  //   var data = $(this).serializeArray();
  //   console.log(data);
  //   var driver = {firstName: data.first_name, lastName: data.last_name, phoneNumber: data.phone_number};
  //   $(this).shift();
  //   $(this).shift();
  //   // $("#field2").val(newValue2);
  //   $(this).append(driver);
    
  // });

  // let fromCitySelector = fromCityDiv.find("select");
  // fromCitySelector.change(() => getCityIps(fromCitySelector.val()));
});

function submitToDedicatedServer(formSelector, departure, action) {
  $.ajax({ 
    url: `${window.location.origin}/servers?city_id=${departure}`,
    type: 'GET',
    cache: false, 
    //data: { field1: 1, field2: 2 }, 
    success: function(dedicated_server_url){
      $(formSelector).attr('action', `${dedicated_server_url}/${action}`);
      // var realAction = $(formSelector).attr("method") +' '+ $(formSelector).attr("action");
      // alert(realAction);
      $(formSelector).submit();
    },
    error: function(jqXHR, textStatus, err){
      alert('text status '+textStatus+', err '+err)
    }
  })
}

function offerRide(){
  // FOR PRODUCTION
  var departure = $("#offer-departure").val();
  var destination = $("#offer-destination").val();
  if(departure === destination) return;
  submitToDedicatedServer("#offer-form", departure, "rides");

  // FOR TESTING ONLY
  // $("#offer-form").attr('action', `${window.location.origin}/rides`);
  // $("#offer-form").submit();
}
function requestRide(){
  // FOR PRODUCTION
  var departure = $("#request-departure").val();
  submitToDedicatedServer("#request-form", departure, "requests");

  // FOR TESTING ONLY
  // $("#request-form").attr('action', `${window.location.origin}/requests`);
  // $("#request-form").submit();
}

function trackRideSubmit(){
  // FOR PRODUCTION
  var rideId = $('#tracking-id').val();
  if(rideId[0] !== 'c') return;
  const cityId = rideId.split('-')[0].split('c')[1];
  submitToDedicatedServer("#track-form", cityId, `rides/${rideId}`);

  //FOR TESTING ONLY
  // var rideId = $('#tracking-id').val();
  // if(rideId == '') {
  //   alert("Ride Id Required");
  //   return;
  // }
  // $("#track-form").attr('action', `${window.location.origin}/rides/${rideId}`);
  // $("#track-form").submit(); 
}
function trackRequestSubmit(){
  // FOR PRODUCTION
  var requestId = $('#tracking-id').val();
  if(requestId[0] !== 'c') return;
  const cityId = requestId.split('-')[0].split('c')[1];
  submitToDedicatedServer("#track-form", cityId, `requests/${requestId}`);
  //FOR TESTING ONLY
  // var requestId = $('#tracking-id').val();
  // if(requestId == '') {
  //   alert("Request Id Required");
  //   return;
  // }
  // $("#track-form").attr('action', `${window.location.origin}/requests/${requestId}`);
  // $("#track-form").submit();
}
function getStateSubmit(){
  $("#track-form").attr('action', `${window.location.origin}/state`);
  $("#track-form").submit(); 
}
function getServer() {
  var serverAddress = $("#select-server").val();
  $("#server-form").attr('action', `${window.location.protocol}//${serverAddress}`);
  $("#server-form").submit();
}



function printAttr(element) {
  element.each(function() {
    $.each(this.attributes, function() {
      // this.attributes is not a plain object, but an array
      // of attribute nodes, which contain both the name and value
      if(this.specified) {
        console.log(this.name, this.value);
      }
    });
  });
}
function activatelogin()
{
  $("#loginbox").css("display","block");
  $("#searchbox").css("display","none");
}

function loadcontent(element, contentfile)
{
  //send an asynchronous request for the content XML.
  var xmlhttp = new XMLHttpRequest();

  //set the response handler.  Objective is to set the content.
  xmlhttp.onreadystatechange=
  function()
  {
    if (xmlhttp.readyState == 4)
    {
      if (xmlhttp.status == 200)
      {
        //basically dump the XML text into the document content container.
        element.innerHTML = xmlhttp.responseText;
      } 
      else
      {
        //or throw a fit.  TODO: make this more pareseable to allow the user to send info to webmaster.
        alert("ERROR: attempt to retrieve content resulted in a " + xmlhttp.status + " error")
      }
    }
  }

  xmlhttp.open("GET",contentfile, true);
  xmlhttp.send();
  var xmlresponse = xmlhttp.responseText;
}


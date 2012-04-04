var find = new Plugin("find");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

find.searchstring = "";
find.searcharray = [];
find.domain = {};

////////////////////////////////////////////////////////////////////////
// OVERLOADING TOKEN FUNCTIONS

find.initialize = function()
{
  find.maketool();
  find.toolbardom.innerHTML += "<input type='text' id='findinput'></input>" +
  "<button>&lt;&lt;</button><button>&gt;&gt;</button>";
  document.getElementById("findinput").addEventListener("keyup", find.find);
  find.toolbardom.onclick = find.show();
}

////////////////////////////////////////////////////////////////////////
// MEMBER FUNCTIONS

find.find = function()
{
  //reset the search value and clear the search array.
  find.searchstring = document.getElementById("findinput").value;
  find.searcharray = [];
  var searchrc = reversecomplement(find.searchstring);
  var searchlength = find.searchstring.length;
  if (searchlength > 2)
  {
    var terminus = editor.sequence.length - searchlength;
    for (var i = 0; i < terminus; i++)
    {
      var slicedstring = editor.sequence.substr(i, searchlength);
      if (slicedstring == find.searchstring)
        find.searcharray.push(i)
      else if (slicedstring == searchrc)
        find.searcharray.push(-i)
    }
  }
}

find.show = function()
{
}



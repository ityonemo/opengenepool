var dialog = {
  //variables
  content:{},
  okbutton:{},
  cancelbutton:{},

  initialize: function()
  {
    dialog.content = document.getElementById("dialogcontent");
    dialog.okbutton = document.getElementById("dialogok");
    dialog.cancelbutton = document.getElementById("dialogcancel");
  },

  show: function(what, callback)
  {
    dialog.content.innerHTML = what;
    if (callback)
    {
      dialog.callback = callback;
      dialog.cancelbutton.style.visibility = 'visible';
      dialog.okbutton.onclick = new Function("dialog.callback(); dialog.hide();");
      dialog.cancelbutton.onclick = dialog.hide;
    }
    else
    {
      dialog.cancelbutton.style.visibility = 'hidden';
      dialog.okbutton.onclick = dialog.hide;
    }
    
    $("#dialog").css("display","block");
  },

  hide: function()
  {
    $("#dialog").css("display","none");
  },
}

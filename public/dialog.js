var dialog = new function Dialog()
{
  $.extend(this,
  {
    //DOM variables
    content:{},
    okbutton:{},
    cancelbutton:{},

    //functions
    callback:{},
    onrender:{},

    initialize: function()
    {
      //assign internal variables to the content which is created in the OGP.haml file.
      dialog.content = document.getElementById("dialogcontent");
      dialog.okbutton = document.getElementById("dialogok");
      dialog.cancelbutton = document.getElementById("dialogcancel");
    },

    show: function(what, callback, onrender)
    {
      //set the content of the dialog box.
      dialog.content.innerHTML = what;

      //has the caller specified a post-render function?  Then execute it.
      if (onrender)
        onrender();

      //has the caller specified a callback?
      if (callback)
      {
        //set up the callback function.
        dialog.callback = callback;
        //make sure we have an option to cancel.
        dialog.cancelbutton.style.visibility = 'visible';
        //this needs to be capital F function because otherwise the assignment will
        //occur at render time, and these functions will not be well-defined.
        dialog.okbutton.onclick = new Function("dialog.callback(); dialog.hide();");
        dialog.cancelbutton.onclick = dialog.hide;
      }
      else
      {
        //this is just an informational dialog box.  hide the cancel button and set the ok to dismiss.
        dialog.cancelbutton.style.visibility = 'hidden';
        dialog.okbutton.onclick = dialog.hide;
      }
    
      //go!
      $("#dialog").css("display","block");
    },

    hide: function()
    {
      //make it go away.
      $("#dialog").css("display","none");
    },
  }
}

//DNA.js contains various DNA manipulation classes and convenience functions.

Sequence = function(string)
{
  //a sequence object stores the forward and the reverse complement
  return {
    fwd: new String(string),
    _5poh: 0,
    _3poh: 0,
  }
};

Domain = function(init)
{
  //A domain is a group of ranges.  It's in fact the most important location-identifying construct
  //all annotations and selections are denoted as domains.

  var temp =
  {
    //member variables:
    ranges: [],

    //populates the domain using OGP string notation e.g. 10..20 + (30..40)
    populate: function(string)
    {
      if (string)
      {
        var rangetexts = string.split("+");
        for (var i = 0; i < rangetexts.length; i++)
        {
          this.ranges.push(new OGPRange(rangetexts[i]))
        }
      }
    },

    orientation: function()
    {
      var total = 0;
      for (var i = 0; i < this.ranges.length; i++)
      {
        total += this.ranges[i].length() * this.ranges[i].orientation;
      }
      if (total > 0) return 1;
      if (total < 0) return -1;
      return 0;
    },

    push: function(range)
    {
      this.ranges.push(range);
    },

    toString: function()
    {
      result = this.ranges[0].toString();
      if (this.ranges.length > 1)
        for (var i = 1; i < this.ranges.length; i++)
          result += " + " + this.ranges[i].toString();
      return result;
    },

    bounds: function()
    {
      var extremestart = this.ranges[0].start, extremeend = this.ranges[0].end;
      if (this.ranges.length > 1)
        for (var i = 1; i < this.ranges.length; i++)
        {
          extremestart = (this.ranges[i].start < extremestart) ? this.ranges[i].start : extremestart;
          extremeend = (this.ranges[i].end > extremeend) ? this.ranges[i].end : extremeend;
        }
      return new Range(extremestart, extremeend, this.orientation()) 
    },

    //pass it a position; does this domain contain it?
    contains: function(what)
    {
      for (var i = 0; i < this.ranges.length; i++)
        if ((i >= this.ranges[i].start) && (i <= this.ranges[i].end)) return true
      return false;
    }
  };

  //initialize this domain.
  if (init) {temp.populate(init)}

  return temp;
}

trim = function(str)
{
  return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '')
}

//regexp objects.
rgxp_complement = /^\(\<?\d+\.\.\>?\d+\)$/
rgxp_undirected = /^\[\<?\d+\.\.\>?\d+\]$/
rgxp_general = /^\d+\.\.\d+$/
rgxp_position = /^\d+$/

OGPRange = function(text)
{
  text = trim(text) 
  
  var start = 0;
  var end = 0;
  var orientation = 0;

  if (rgxp_complement.test(text))
  {
    var arr = text.slice(1,-1).split("..");
    start = parseInt(arr[0]);
    end = parseInt(arr[1]);
    orientation = -1;
  }
  else if (rgxp_undirected.test(text))
  {
    var arr = text.slice(1,-1).split("..");
    start = parseInt(arr[0]);
    end = parseInt(arr[1]);
  }
  else if (rgxp_general.test(text))
  {
    var arr = text.split("..");
    start = parseInt(arr[0]);
    end = parseInt(arr[1]);
    orientation = 1;
  }
  else if (rgxp_position.test(text))
  {
    start = parseInt(text);
    end = parseInt(text);
  }
  return Range(start, end, orientation)
}

Range = function(_start, _end, _orientation)
{
  //preconditions:
  //_start < _end, unless _orientation == null;
  //if _orientation == null then redefine based on relative
  //positions of start and end

  //postcondition:
  //orientation == -1 or 1.

  //normalize the orientation to clear all false values to zero.
  //this allows passing null to this function as a default value.
  _orientation = (_orientation) ? (_orientation) : 0;
  _start = (_start) ? (_start) : 0;
  _end = (_end) ? (_end) : 0;

  var output = {
    start: _start,
    end: _end,
    orientation: _orientation,

    span: function ()
    //return spanning information for the range
    //spanning information is an object with the following properties:
    //  start_s - starting segment
    //  end_s - ending segment
    //  start_p - position within starting segment
    //  end_p - position within ending segment
    {
      //figure out which segment they're going to be in, and where in that segement.
      var startsegment = Math.floor((this.start)/graphics.settings.zoomlevel);
      var endsegment = Math.floor((this.end)/graphics.settings.zoomlevel);
      var startpos = (this.start)%graphics.settings.zoomlevel;
      var endpos = (this.end)%graphics.settings.zoomlevel;
      //adjust it so that it's flush with the end of the line instead of the beginning.
      if ((endpos == 0) && (this.start != this.end))
      {
        endsegment--;
        endpos = graphics.settings.zoomlevel;
      }

      return {
        start_s: startsegment,
        end_s: endsegment,
        start_p: startpos,
        end_p: endpos
      }
    },

    toString: function()
    {
      var content = this.start + ".." + this.end;
      switch (this.orientation)
      {
        case -1:
        return "(" + content + ")";
        case 0:
        return "[" + content + "]";
        case 1:
        return content;
      }
    },

    length: function()
    {
      return this.end - this.start;
    },

    toGenBank: function()
    {
      return ((this.orientation == -1) ? "complement" : "") + this.toString(); 
    },

    datastring: function()
    {
      return this.start + ", " + this.end + ", " + this.orientation;
    },
  };

  //refactor the orientation if we have supplied it with a null value.
  if (_orientation == undefined)
  {
    if (_start > _end)
    {
      output.orientation = -1;
      output.start = _end;
      output.end = _start;
    }
    else {output.orientation = 1;}
  }

  return output;
}

/////////////////////////////////////////////
// generic reverse complement
// this function respects cases.
function reversecomplement(string)
{
  var tempstring = "";
  for(var i = 1; i <= string.length; i++)
  {
    switch(string.charAt(string.length-i))
    {
      //standard single letter codes
      case 'a': tempstring += 't'; break;
      case 't': tempstring += 'a'; break;
      case 'c': tempstring += 'g'; break;
      case 'g': tempstring += 'c'; break;
      case 'A': tempstring += 'T'; break;
      case 'T': tempstring += 'A'; break;
      case 'C': tempstring += 'G'; break;
      case 'G': tempstring += 'C'; break;
      //variable single letters
      case 'n': tempstring += 'n'; break;
      case 'x': tempstring += 'x'; break;
      case 'N': tempstring += 'N'; break;
      case 'X': tempstring += 'X'; break;
      //extended IUPAC, two letters
      case 'r': tempstring += 'y'; break;
      case 'y': tempstring += 'r'; break;
      case 'm': tempstring += 'k'; break;
      case 'k': tempstring += 'm'; break;
      case 's': tempstring += 's'; break;
      case 'g': tempstring += 'g'; break;
      //extended IUPAC, two letters, caps
      case 'R': tempstring += 'Y'; break;
      case 'Y': tempstring += 'R'; break;
      case 'M': tempstring += 'K'; break;
      case 'K': tempstring += 'M'; break;
      case 'S': tempstring += 'S'; break;
      case 'G': tempstring += 'G'; break;
      //extended IPAC, three letters
      case 'h': tempstring += 'd'; break;
      case 'd': tempstring += 'h'; break;
      case 'b': tempstring += 'v'; break;
      case 'v': tempstring += 'b'; break;
      //extended IPAC, three letters, caps
      case 'H': tempstring += 'D'; break;
      case 'D': tempstring += 'H'; break;
      case 'B': tempstring += 'V'; break;
      case 'V': tempstring += 'B'; break;
    }
  }
  return tempstring;
}

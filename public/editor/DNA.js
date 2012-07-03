//DNA.js contains various DNA manipulation classes and convenience functions.

Span = function()
{
  //A span is an array of ranges.  It's in fact the most important location-identifying construct, since
  //all annotations and selections are denoted as span.

  //you can initialize a span with any number of spans, ranges, or spanstrings (note that spanstrings
  //are a superset of rangestrings).  However, you may not use individual integers (as you might for a Range).

  for (var i = 0; i < arguments.length; i++)
    try {this.push(arguments[i])}
    catch (e) {throw new Error("error initializing domain, problem with argument " + arguments[i] + ": " + e.toString())}
}

//inherit all of the array properties into Domain.
Span.prototype = new Array();
Span.prototype._push = Span.prototype.push; //redefine the old "push" to "_push"

//define further properties for Domain:
$.extend(Span.prototype,
{
  orientation: function()
  // determines the overall orientation of this domain.
  // precondition: none
  // postcondition: returns 1, or -1 depending on whether plus strand components are more prevalent than minus strand
  // components.  NB: If they are equal, or there are mostly undirected componenets, then this function outputs PLUS.
  {
    var plus = 0;
    var minus = 0;

    //go over the array and sum up the lengths to determine the dominant component.
    for (var i = 0; i < this.length; i++)
      switch (this[i].orientation)
      {
        case -1:
          minus += this[i].length;
        break;
        case 1:
          plus += this[i].length;
        break;
      }

    //output as decided.
    return (plus >= minus) ? 1 : -1;
  },

  bounds: function()
  {
    //set up extreme starts and ends
    var extremestart = this[0].start;
    var extremeend = this[0].end;

    if (this.ranges.length > 1)
      for (var i = 1; i < this.ranges.length; i++)
      {
        extremestart = (this.ranges[i].start < extremestart) ? this.ranges[i].start : extremestart;
        extremeend = (this.ranges[i].end > extremeend) ? this.ranges[i].end : extremeend;
      }
    return new Range(extremestart, extremeend, 0) 
  },

  ////////////////////////////////////////////////////////////////////////////
  // OVERLOADED functions

  push: function()
  {
    for (var i = 0; i < arguments.length; i++)
      if (arguments[i] instanceof Domain)
      {
        for (var j = 0; j < arguments[i].length; j++)
          this._push(arguments[i][j]);
      } 
      else if (arguments[i] instanceof Array)
      {
        for (var j = 0; j < arguments[i].length; j++)
          this.push(arguments[i][j]);  //should be a recursive call to allow for repeated checking.
      }
      else if (arguments[i] instanceof Range)
      {
        this._push(arguments[i]);
      } 
      else if (typeof(arguments[i]) == "object")
      {
        //check to see if we have what we need.
        if ((arguments[i].start !== undefined) && (arguments[i].end !== undefined))
          this._push(new Range(arguments[i].start, arguments[i].end, arguments[i].orientation))
          //note that if orientation is undefined, thes will figure it out for you.
        else
          throw new Error("cannot pushed a non range-like object")
      }
      else if (typeof(arguments[i]) == "string")
      {
        ranges = arguments[i].split("+")
        for (var j = 0; j < ranges.length; j++)
        {
          try {this._push(new Range(ranges[j].trim()));}
          catch (e) {throw new Error("cannot push a malformed rangestring: " + ranges[j] + "; " + e.toString())}
        }
      } else
      throw new Error("cannot push a non-range, non-domain object into a domain: " + arguments[i])
  },

  ////////////////////////////////////////////////////////////////////////////
  // OUTPUT FUNCTIONS

  toString: function()
  {
    return this.join(" + ");
  },

  genbank: function()
  // outputs based on Genbank results.
  // NB: genbank requires origin to 
  {
    return "join(" + this.join() + ")";
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////
// RANGE OBJECT.  Specifies a range of DNA, using the XXX method.

Range = function() //parameters analyzed via arguments array.
{
  //constructor for a range object
  //two options:  1) string format: a..b, (a..b) - reverse complement, [a..b] - dual-strand
  //              2) numerical format:  start, end, orientation.

  //preconditions:
  //_start < _end, unless _orientation == null;
  //if _orientation == null then redefine based on relative
  //positions of start and end

  //postcondition:
  //orientation == -1, 0, or 1.

  var start, end, orientation;

  ///////////////////////////////////////////////////////////////////////////////////////
  // ARGUMENT PREPROCESSING

  switch(arguments.length)
  {
    case 0:
      this.start = this.end = 0;
    case 1:
      if (typeof arguments[0] == "string")
      {
        //process the string to check to see what's going on.
        var arg = arguments[0];
        var first = arg[0]; last = arg[arg.length - 1];
        //check the orientation.
        if ((first == "(") && (last == ")"))
        {
          orientation = -1;
          arg = arg.slice(1,-1);
        }
        else if ((first == "[") && (last == "]"))
        {
          orientation = 0;
          arg = arg.slice(1,-1);
        }
        else orientation = 1;

        //process the internal string content.
        var rangedata = arg.split("..");

        //allow for the processing of single-value things.
        if (rangedata[1] === undefined)
          rangedata[1] = rangedata[0];

        start = parseInt(rangedata[0]);  
        end = parseInt(rangedata[1]);

        //make sure the result makes sense.
        if (end < start)
          throw new Error("Range object constructed with out-of-order input")
      }
      else if (!isNaN(arguments[0]))
      {
        //we know this is a between-bases-argument.
        start = arguments[0]; 
        end = arguments[0]; 
        orientation = 0;
      }
      else if (arguments[0] instanceof Range)
      {
        start = arguments[0].start;
        end = arguments[0].end;
        orientation = arguments[0].orientation;
      }
      else
        throw new Error("invalid input to Range object constructor");
    break;
    default:
      //specify only the endpoints, let order determine the orientation.
      //make initial assignments
      start = parseInt(arguments[0]);
      end = parseInt(arguments[1]);
      orientation = parseInt(arguments[2]);

      if (isNaN(orientation))
        //check to see if we need to flip the values.
        if (start > end)
        {
          orientation = -1;
          end = parseInt(arguments[0]);
          start = parseInt(arguments[1]);
        } else
        orientation = 1;
    break;
  }

  //error checking on the values.
  if (isNaN(start) || isNaN(end) || isNaN(orientation))
    throw new Error("non-numerical input(s) to Range object constructor")
  if ((start < 0) || (end < 0))
    throw new Error("input values must be non-negative")

  $.extend(this,
  {
    start: start, 
    end: end, 
    orientation: orientation,
  });
};

////////////////////////////////////////////////////////////////////////////////////
// extending the Range functions

Range.prototype =
{
  //////////////////////////////////////////////////////////////////////////////////
  // Range manipulation operations.

  shift: function(amount)
  {
    //moves over a range by a certain number of base pairs.
    _amount = parseInt(amount);
    if (isNaN(_amount))
      throw new Error("cannot shift a range by a non-numerical value " + amount);

    //shift!
    this.start += _amount;
    this.end += _amount;
  },

  flip: function()
  {
    //flips the orientation of the range.  Does not affect unoriented ranges.
    this.orientation *= -1;
  },

  shrink: function(amount, front)
  {
    //shrinks a range from its 3' end (unless you specify a truthy value for front) by amount.
    _amount = parseInt(amount);
    if (isNaN(_amount))
      throw new Error("cannot shrink a range by non-numerical value " + amount);

    if (_amount > this.length)
      throw new Error("cannot shrink a range by more than its length (" + _amount + ">" + this.length + ")");

    //changes either the start or the end, but we have to decide what.
    if ((this.orientation < 0) ? !front : front)  //sneaky XOR operation.
      this.start += _amount;
    else
      this.end -= _amount;
  },

  //////////////////////////////////////////////////////////////////////////////////
  // Range testing operations
  contains: function(p, q)
  {
    //preconditions:  must be passed either a range, rangestring, or a numerical position value.
    //postconditions: returns true if the passed range is contained inside this range
    //                or if the position is inside this range.

    //check to see if we are being passed a range.
    if (p instanceof Range)
      return ((p.start >= this.start) && (p.end <= this.end));

    //if we are a rangestring
    if (typeof (p) == "string")
      try { return (this.contains(new Range(p)));}
      catch (e) { throw new Error("cannot range test against the non-range string " + p + "; " + e.toString()); }

    //convert p to an integral value.
    var _p = parseInt(p);
    //do an error checking to make sure we are actually being passed a number.
    if (isNaN(_p))
      throw new Error("cannot range test against the non-numerical value" + p);

    if (isNaN(q))  //do we have a q?
      return ((_p >= this.start) && (p <= this.end));
    else  //we do have a q, so go ahead and make that an integer.
    {
      q = parseInt(q);
      return ((Math.max(_p,q) >= this.start) && (Math.min(_p,q) <= this.end));
    }
  },

  overlaps: function(p, q)  //passed values analyzed by arguments array
  {
    //preconditions: must be passed either a range, rangestring, or even a pair of numerical values determining a range.
    //postcondition: returns

    //check to see if we have been passed a range.
    if (p instanceof Range)
      return !((p.end < this.start) || (p.start > this.end));

    //if it's a rangestring
    if (typeof (p) == "string")
      try { return (this.overlaps(new Range(p)));}
      catch (e) { throw new Error("cannot range test against the non-range string " + p + "; " + e.toString()); }

    //convert p and q to an integral values.
    var _p = parseInt(p);
    var _q = parseInt(q);

    //do an error checking to make sure we are actually being passed a number.
    if (isNaN(_p) || isNaN(_q))
      throw new Error("cannot range test against a non-numerical value for inputs " + p + " and " + q);

    return !((Math.max(_p,_q) < this.start) || (Math.min(p,q) > this.start));
  },

  /////////////////////////////////////////////////////////////////////////
  // output functions

  toString: function(gb)
  //outputs a string representation of the object.  If you pass a truey value to toString,
  //then outputs numbers using genbank convention.
  {
    var _start = gb ? this.start + 1 : this.start;
    var content;

    //set the content value.
    if (_start > this.end)
      content = this.end + "^" + _start;
    else if (_start == this.end)
      content = this.end.toString();
    else
      content = _start + ".." + this.end;

    switch (this.orientation)
    {
      case -1:
        return "(" + content + ")";
      case 0:
        return (gb ? "" : "[") + content + (gb ? "" : "]");
      case 1:
        return content;
    }
  },

  genbank: function()
  {
    return ((this.orientation == -1) ? "complement" : "") + this.toString(true); 
  },

  extract: function(string, offset)
  //extracts the contents of the range from the passed DNA string.  you can specify that the provided sequence
  //is offset by some amount (optional)
  {
    var _offset = parseInt(offset);
    if ((!isNaN(_offset)) && _offset > this.start)
      throw new Error("sequence provided does not overlap range; offset " + _offset + " too far");
    var start = isNaN(_offset) ? this.start : this.start - offset;
    var end = isNaN(_offset) ? this.end : this.end - offset;

    //error checking over the provided string
    if (typeof(string) != "string") throw new Error("data supplied to extract is not a string");
    if (string.length < end) throw new Error("sequence provided does not over lap range; end " + this.end + " too far");

    if (this.orientation >= 0)
      return string.slice(start, end);
    else
      return reversecomplement(string.slice(start,end));
  }
}

Range.prototype.__defineGetter__("length",function(){return this.end - this.start});

//////////////////////////////////////////////////////////////////////////////////////
// generic reverse complement over strings containing dna sequences
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

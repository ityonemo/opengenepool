//DNA.js contains various DNA manipulation classes and convenience functions.

Sequence = function(string)
{
  //a sequence object stores the forward and the reverse complement
  return {
    fwd: new String(string),
    rc: new String(reversecomplement(string)),
    _5poh: 0,
    _3poh: 0,
  }
};

GenBankSeqRange = function(rangetext)
{
  //set default orientation to forward.
  var orientation = 1;
  var originaltext = new String(rangetext);

  //for now, just check for the presence of a "complement"
  if (rangetext.substring(0,11) == "complement(")
  {
    //trim that shit off the front.
    rangetext = rangetext.substring(11);
    orientation = -1;
  };

  var starttext = rangetext.split("..")[0];
  var endtext = rangetext.split("..")[1];

  if (!endtext) {endtext = starttext};

  var start = parseInt(starttext);
  var end = parseInt(endtext);

  range = new SeqRange(start, end, orientation);
  range.text = originaltext;  //associate the range text with our object.
  return range;
}

SeqRange = function(_start, _end, _orientation)
{
  //preconditions:
  //_start < _end, unless _orientation == 0;
  //if _orientation == 0 then redefine based on relative
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
  };

  //refactor the orientation if we have supplied it with a zero value.
  if (_orientation == 0)
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

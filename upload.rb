get '/upload' do
  handleuser

  #fixes bug that makes it impossible to do this across multiple sessions.
  $keywordhash = {};
  $annotations = [];

  @scriptlist = (session[:user] == nil) ? ([]) : (["upload.js","jquery.js"])
  @csslist = ["upload.css"]

  @content = (session[:user] == nil) ? (haml :loginerror) : (haml :upload)

  haml :ogp
end

#posting an upload should basically look identical to 'getting' an upload, except
#various variables have been filled out by the genbank processing stuff.

post '/upload' do
  handleuser

  if (session[:user])
    unless params[:file] &&
      (tmpfile = params[:file][:tempfile]) &&
      (name = params[:file][:filename])
      @error = "No file selected"
      return haml(:upload)
    end

    STDERR.puts "Uploading file, original name #{name.inspect}"
  
    gbparse(tmpfile)
  end

  @scriptlist = (session[:user] == nil) ? ([]) : (["upload.js","jquery.js"])
  @csslist = ["upload.css"]

  @content = (session[:user] == nil) ? (haml :loginerror) : (haml :upload)

  haml :ogp
end

#genbank domain conversion to opengenepool domain spec

#various regexps that are useful for this conversion.
$join = /\Ajoin\((.*)\)\Z/
$complement = /\Acomplement\((.*)\)\Z/
$order = /\Aorder\((.*)\)\)\Z/
$range = /\A(\<?)(\d+)\.\.(\>?)(\d+)\Z/
$carat = /\A(\d+)\^(\d+)\Z/
$base = /\A(\d+)\Z/

def rangeparse(string, seg_array, orientation)
  @of = (orientation == -1) ? "(" : ""
  @or = (orientation == -1) ? ")" : ""

  if (string =~ $complement)
    orientation = -orientation
    rangeparse($complement.match(string)[1].strip, seg_array, orientation)
  elsif (string =~ $range)
    @match = $range.match(string)
    if (Integer(@match[2]) < Integer(@match[4]))
      seg_array.push(@of + (@match[1] == "<" ? "<" : "") + 
                     (Integer(@match[2]) - 1).to_s + ".." + (@match[3] == ">" ? ">": "") + @match[4] + @or)
    end
  elsif (string =~ $carat)
    @match = $carat.match(string)
    if (Integer(@match[1]) == Integer(@match[2]) - 1)
      seg_array.push(String.new(@match[1]))
    end
  elsif (string =~ $base)
    seg_array.push(@of + (Integer(@match[1]) - 1).to_s + ".." + @match[1] + @or)
  end
end

def assemble(string, seg_array, orientation)
  componentsarray=string.split(/,/)
  componentsarray.each do |part|
    rangeparse(part.strip, seg_array, orientation)
  end
end

def domainparse(string, seg_array, orientation)
  if (string =~ $join)
    assemble($join.match(string.strip)[1], seg_array, orientation) 
  elsif (string =~ $order)
    assemble($order.match(string.strip)[1], seg_array, orientation)
  elsif (string =~ $complement)
    orientation = -orientation
    domainparse($complement.match(string)[1].strip, seg_array, orientation)
  else
    rangeparse(string.strip, seg_array, orientation)
  end
  return seg_array
end


#data in the haml file that can be filled in.
$keywordhash = Hash.new()
$keywordarray = ["LOCUS", "DEFINITION", "ACCESSION", "VERSION", "KEYWORDS", "SOURCE", "ORGANISM"]
$annotations = Array.new()
$sequence = ""
$featureindent = 0

def simpleextract(string)
  ($contenthash.has_key?(string)) ? ($contenthash[string]) : ""
end

def simpletransfer(string)
  $keywordhash[string] = simpleextract(string)
end

class Annotation
  attr_accessor :type, :caption, :domain, :data, :index, :datahash
  
  def initialize
    @datahash = Hash.new()
  end

  def finalize
    if @datahash.has_key?("gene")
      @caption = @datahash["gene"][/[\w\s]+/]
    elsif @datahash.has_key?("note")
      @caption = @datahash["note"].split(/[^\w\s]/)[0]
    end
  end

  def to_s
    "'" + @caption + "', '" + @type + "', '" + @domain + "'" 
  end
end

def process()
  $keywordhash["LOCUS"] = simpleextract("LOCUS").split(/\s+/)[0]
  simpletransfer("DEFINITION")
  simpletransfer("ACCESSION")
  simpletransfer("VERSION")
  simpletransfer("KEYWORDS")
  $keywordhash["SOURCE"] = simpleextract("SOURCE").split(/\n/)[0]
  $keywordhash["ORGANISM"] = simpleextract("SOURCE").split(/\n/)[1].strip().split(/\s+/,2)[1]
  $sequence = simpleextract("ORIGIN").gsub(/[\d\s\/]/,"")

  $current_annotation = nil
  $current_property = ""

  $annotationslines = simpletransfer("FEATURES")
  $annotationslines.each_line do |line|
    if (line.index(/\S/) < $featureindent)
      if ($current_annotation != nil)
        $current_annotation.finalize()
        $annotations.push($current_annotation)
      end
      $current_annotation = Annotation.new()
      myline = line.strip().split(/\s+/)
      $current_annotation.type = String.new(myline[0])
      $current_annotation.domain = domainparse(myline[1].strip, Array.new(), 1).join('+')
      $current_annotation.index = $annotations.length()
      $current_annotation.data = "";
    else
      $current_annotation.data += line;
      temp = line.strip()
      if (temp[0,1] == '/')  #check to see if we have a slash winner!
        temparray = temp.split('=',2)
        $current_property = temparray[0].slice(1..-1) #chop off the slash.
        $current_annotation.datahash[$current_property] = temparray[1].slice(1..-1) #chop off the starting quote.
        $current_annotation.datahash[$current_property].chomp!('"')
        $current_annotation.datahash[$current_property].gsub('/','-')
      else
        $current_annotation.datahash[$current_property] += temp
        $current_annotation.datahash[$current_property].chomp!('"')
        $current_annotation.datahash[$current_property].gsub('/','-')
      end
    end
  end
end

def gbparse(file)
  data = File.open(file.path, "rb") { |f| f.read() }
  buffer = StringIO.new(data.rstrip!(), 'rb')

  $contenthash = Hash.new()
  @currentfield = ""

  buffer.each_line do |line|
    if (line =~ /\A[A-Z]/)
      splitline = line.split(/\s+/,2)
      @currentfield = splitline[0]

      #hack to take advantage of the fact that ORIGINs are only one line,
      #contain obsolete information, and signal the beginning of the sequence
      #part of the gb file.
      if (@currentfield == "FEATURES")
        $featureindent = line.index("Location")
        $contenthash[@currentfield] = ""
      else
        $contenthash[@currentfield] = (@currentfield == "ORIGIN") ? "" : splitline[1]
      end
    else
      $contenthash[@currentfield] += line
    end
  end
  process()
end

post '/uploadseq' do
  #check to make sure we are logged in and fail if we are not.
  unless session[:user]
    return 403
  end
    
  #generate the command for creating the sequence in MySQL.
  #TODO: do some checking to make sure we aren't going to pull a bobby tables here.

  #store all of the http parameters as a giant hash.
  #note that annotations are stored in the syntax as prepared by the form.
  seqvals = Hash[params.select{|k, v| $TD_SEQUENCES.include? k}]  #select only the values whose key are in $TD_SEQUENCES
  seqvals.store("created", DateTime.now)
  seqvals.store("owner", session[:user])
  seqvals.store("visibility", "public")

  #generate a temporary store for the annotations.
  annotations = Hash.new
  #generate the hash storing the annotations, recollated
  params.each_key() do |key|
    if (key =~ /\Aannotation/)
      keyarray = key.split("_",2)
      unless (annotations.has_key?(keyarray[0]))
        annotations[keyarray[0]] = Hash.new
      end
      annotations[keyarray[0]][keyarray[1]] = params[key];
    end
  end

  #initiate the connection to the mysql database
  db_connect

    seqid = $DB[:sequences].insert(seqvals)

    #generate the commands for creating the annotations
    annotations.each do |key,value|
      #note that "key" only contains crap values from the html form, what we really want are the hashes that
      #get assigned to "value".


      #filter out things that don't belong in the database table.
      annvals = Hash[value.select{|k, v| $TD_ANNOTATIONS.include? k}]
      #next add important records to the annotations values.
      annvals.store("created", DateTime.now)
      annvals.store("sequence", seqid)
      annvals.store("owner", session[:user])
      annvals.store("visibility", "public")
      #then add them to the annotations table.
      annid = $DB[:annotations].insert(annvals)

      value.each do |key2, value2|
        if (key2 =~ /\Adata/)
          name = key2.split("_")[1]
          $DB[:annotationdata].insert(
            {:annotation => annid,
             :owner => session[:user],
             :created => DateTime.now,
             :visibility => "public",
             :infokey => name,
             :value => value2,
            }
          )
        end
      end
    end

  #close the connection
  $DB.disconnect

  redirect("/editor/id=" + seqid.to_s)
end


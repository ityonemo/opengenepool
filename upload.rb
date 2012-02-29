get '/upload' do
  handleuser()

  @scriptlist = (session[:user] == nil) ? ([]) : (["upload.js","jquery.js"])
  @csslist = ["upload.css"]

  @content = (session[:user] == nil) ? (haml :loginerror) : (haml :upload)

  haml :ogp
end

#posting an upload should basically look identical to 'getting' an upload, except
#various variables have been filled out by the genbank processing stuff.

post '/upload' do
  handleuser()

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
  attr_accessor :type, :caption, :range, :data, :index, :datahash
  
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
    "'" + @caption + "', '" + @type + "', '" + @range + "'" 
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
  $current_property = nil

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
      $current_annotation.range = String.new(myline[1])
      $current_annotation.index = $annotations.length()
      $current_annotation.data = "";
    else
      $current_annotation.data += line;
      temp = line.strip()
      if (temp[0] == 47)  #check to see if we have a slash winner!
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

$mysqlarray = ["locus","title","definition","accession","version","keywords","source","organism","sequence"]
#helper function that evaluates a hash with an array
def transcode(array, hash)
  @t_array = Array.new
  array.each() do |key|
    @t_array.push(hash.has_key?(key) ? hash[key] : '')
  end
  @t_array
end

post '/uploadseq' do
  if(session[:user])
    
    #generate the command for creating the sequence in MySQL.
    #TODO: do some checking to make sure we aren't going to pull a bobby tables here.
    $keyjoin = $mysqlarray.join(", ")
    $valjoin = "'" + transcode($mysqlarray,params).join("', '") + "'"

    $annotations = Hash.new()
    #generate the hash storing the annotations, recollated
    params.each_key() do |key|
      if (key =~ /\Aannotation/)
        keyarray = key.split("_",3)
        trimmedkey = keyarray[0]
        unless ($annotations.has_key?(trimmedkey))  #if we need it, generate the annotation
          $annotations[trimmedkey] = Annotation.new()
        end
        #TODO: fix this so that we don't do a bobby tables
        case keyarray[1]
          when "caption"
            $annotations[trimmedkey].caption = params[key]
          when "type"
            $annotations[trimmedkey].type = params[key]
          when "range"
            $annotations[trimmedkey].range = params[key]
          when "data"
            $annotations[trimmedkey].datahash[keyarray[2]] = params[key]
        end
      end
    end

    #initiate the connection to the mysql database
    dbh=Mysql.real_connect("localhost","www-data","","ogp")

      #upload the sequence data into the database.
      dbh.query("INSERT INTO sequences (#{$keyjoin}, owner) VALUES (#{$valjoin}, '#{session[:user]}')")
      #retrieve the id.
      sequence_id_string = dbh.insert_id().to_s

      #generate the commands for creating the annotations
      $annotations.each() do |key,value|
        #generate the text.  Note that the annotation object has overloaded the "to_s" to provide the correct output here.
        dbh.query("INSERT INTO annotations (sequence, caption, type, seqrange, owner)" +
          " VALUES ('#{sequence_id_string}', #{value}, '#{session[:user]}');")

        annotation_id_string = dbh.insert_id().to_s

        value.datahash.each() do |hkey, hvalue|
          dbh.query("INSERT INTO annotationdata (annotation, infokey, value) VALUES ('#{annotation_id_string}','#{hkey}','#{hvalue}');")
        end
      end

      #close the connection
    dbh.close if dbh
  end
end


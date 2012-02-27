require 'bio'

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
    if @datahash.has_key?("/gene")
      @caption = @datahash["/gene"][/[\w\s]+/]
    elsif @datahash.has_key?("/note")
      @caption = @datahash["/note"].split(/[^\w\s]/)[1]
    end
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
        $current_property = temparray[0]
        $current_annotation.datahash[$current_property] = temparray[1]
      else
        $current_annotation.datahash[$current_property] += temp
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
end


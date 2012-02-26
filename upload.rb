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

$keywordhash = Hash.new()
$keywordarray = ["LOCUS", "DEFINITION", "ACCESSION", "VERSION", "KEYWORDS", "SOURCE", "ORGANISM"]
$sequence = ""
$featureindent = 0

def simpleextract(string)
  ($contenthash.has_key?(string)) ? ($contenthash[string]) : ""
end

def simpletransfer(string)
  $keywordhash[string] = simpleextract(string)
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
  
  $annotationstype = Array.new()
  $annotationscaption = Array.new()
  $annotationsrange = Array.new()
  $annotationsdata = Array.new()
  $annotation_data = String.new("")

  $annotationslines = simpletransfer("FEATURES")
  $annotationslines.each_line do |line|
    if (line.index(/\S/) < $featureindent)
      myline = line.strip().split(/\s+/)
      $annotationstype.push(String.new(myline[0]))
      $annotationsrange.push(String.new(myline[1]))
      $annotationsdata.push($annotation_data)
      $annotation_data = String.new("")
    else
      $annotation_data += line.strip()
    end
  end
  $annotationsdata.shift()
  $annotationscount = $annotationstype.length() - 1
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


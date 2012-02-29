#seq.rb - provides sequence information when queried.

require 'mysql'

class AnnoML
  attr_accessor :caption, :type, :range, :id, :dataarray

  def initialize (caption, type, range, id)
    @caption = caption
    @type = type
    @range = range
    @id = id

    @dataarray = Array.new()
  end
end

get '/seq/:query' do |query|
  #need to sanitize input

  $annotations = Array.new()

  #connect to the database.
  dbh=Mysql.real_connect("localhost","www-data","", "ogp")
    #query the sequences database for the sequence, use the unique ID.

    if (query[0..2].eql?("id="))
      res=dbh.query("SELECT * FROM sequences WHERE (id='"+ query[3..-1] +"');")
    else
      res=dbh.query("SELECT * FROM sequences WHERE (title='#{query}');")
    end

    #save in the "sequence" variable for haml.
    @result = res.fetch_hash()

    #query the sequence-dependent annotations database for the annotations.
    res2=dbh.query("SELECT * FROM annotations WHERE (sequence='#{@result['id']}')")
    (1..res2.num_rows).each do
      @annoresult = res2.fetch_hash()
 
      curranno = AnnoML.new(@annoresult["caption"],@annoresult["type"],@annoresult["seqrange"],@annoresult["id"])
      
      #query the annotations-dependent subdata database.
      res3=dbh.query("SELECT * FROM annotationdata WHERE (annotation='#{@annoresult['id']}')")
      (1..res3.num_rows).each do
        @annodata = res3.fetch_hash()
        curranno.dataarray.push([@annodata["id"], @annodata["infokey"], @annodata["value"]])
      end

      $annotations.push(curranno)
    end
  dbh.close if dbh
  
  haml :query
end

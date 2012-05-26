#seq.rb - provides sequence information when queried.

require 'mysql'

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
class AnnoML
  attr_accessor :caption, :type, :domain, :id, :dataarray
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
  #connect to the database
  db_connect
>>>>>>> Stashed changes

  def initialize (caption, type, domain, id)
    @caption = caption
    @type = type
    @domain = domain
    @id = id

    @dataarray = Array.new()
  end
end

get '/seq/:query' do |query|
  #need to sanitize input

  $annotations = Array.new()

<<<<<<< Updated upstream
<<<<<<< Updated upstream
  #connect to the database.
  dbh=Mysql.real_connect($dbhost,$dblogin,$dbpass, $dbname)
    #query the sequences database for the sequence, use the unique ID.

    if (query[0..2].eql?("id="))
      res=dbh.query("SELECT * FROM sequences WHERE (id='"+ query[3..-1] +"');")
    else
      res=dbh.query("SELECT * FROM sequences WHERE (title='#{query}');")
    end

    #save in the "sequence" variable for haml.
    @result = res.fetch_hash()

    @error = (@result == nil);

    unless (@error)  #because don't bother, is why.
      #query the sequence-dependent annotations database for the annotations.

      tres = dbh.query("CREATE TEMPORARY TABLE tann SELECT * FROM annotations WHERE (sequence='#{@result['id']}');")
      #in the future, eliminations based on user and such will occur here.
      #pivot against annotations which have been superceded.
      #NB there may be a faster way to deal with this code.
      tres = dbh.query("CREATE TEMPORARY TABLE tann2 SELECT (supercedes) FROM tann WHERE (supercedes > 0);")
      tres = dbh.query("DELETE FROM tann WHERE id IN (SELECT * FROM tann2);")
      tres = dbh.query("DELETE FROM tann WHERE status='deleted';");

<<<<<<< Updated upstream
      res2=dbh.query("SELECT * FROM tann;")
      (1..res2.num_rows).each do
        @annoresult = res2.fetch_hash()
 
        curranno = AnnoML.new(@annoresult["caption"],@annoresult["type"],@annoresult["domain"],@annoresult["id"])
      
        #query the annotations-dependent subdata database.
        res3=dbh.query("SELECT * FROM annotationdata WHERE (annotation='#{@annoresult['id']}');")
        (1..res3.num_rows).each do
          @annodata = res3.fetch_hash()
          curranno.dataarray.push([@annodata["id"], @annodata["infokey"], @annodata["value"]])
        end
=======
=======
>>>>>>> Stashed changes
    @tr = $DB.create_table!(:tann, :as => "SELECT * FROM annotations WHERE (sequence = '#{@result[:id]}');", :temp => true)
      #in the future, eliminations based on user and such will occur here.
      #pivot against annotations which have been superceded.
    @tr = $DB.create_table!(:tann2, :as => "SELECT (supercedes) FROM tann WHERE (supercedes > '0');", :temp => true)
 
    @tr = $DB["SELECT * FROM tann WHERE id IN (SELECT * FROM tann2);"].delete
    @tr = $DB["SELECT * FROM tann WHERE status='deleted';"].delete

<<<<<<< Updated upstream
=======
    @tr = $DB.create_table!(:tann, :as => "SELECT * FROM annotations WHERE (sequence = '#{@result[:id]}');", :temp => true)
      #in the future, eliminations based on user and such will occur here.
      #pivot against annotations which have been superceded.
    @tr = $DB.create_table!(:tann2, :as => "SELECT (supercedes) FROM tann WHERE (supercedes > '0');", :temp => true)
 
    @tr = $DB["SELECT * FROM tann WHERE id IN (SELECT * FROM tann2);"].delete
    @tr = $DB["SELECT * FROM tann WHERE status='deleted';"].delete

>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    @annotations = $DB["SELECT * FROM tann;"].all
  end
>>>>>>> Stashed changes

        $annotations.push(curranno)
      end
    end
  dbh.close if dbh
  
  if @error
    status 404
  else
    haml :query
  end
end

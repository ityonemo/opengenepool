#seq.rb - provides sequence information when queried.

get '/seq/:query' do |query|
  #TODO: need to sanitize input

  db_connect

  #initialize a new annotations array.
  $annotations = Array.new()

  #check to see if we are using the id.
  if (query[0..2].eql?("id="))
    @result = $DB["SELECT * FROM sequences WHERE (id='"+ query[3..-1] +"');"].first
  else
    @result = $DB["SELECT * FROM sequences WHERE (title='#{query}');"].first
  end

  #save in the "sequence" variable for haml.
  @error = (@result == nil);

  unless (@error)  #because don't bother, is why.
    #query the sequence-dependent annotations database for the annotations.

    @tr = $DB.create_table!(:tann,
      :as => "SELECT * FROM annotations WHERE (sequence = #{@result[:id]});")
      #in the future, eliminations based on user and such will occur here.
      #pivot against annotations which have been superceded.
    @tr = $DB.create_table!(:tann2,
      :as => "SELECT (supercedes) FROM tann WHERE (supercedes > 0);")
<<<<<<< Updated upstream
 
    @tr = $DB["SELECT * FROM tann WHERE id IN (SELECT * FROM tann2);"].delete
    @tr = $DB["SELECT * FROM tann WHERE status='deleted';"].delete

    @annotations = $DB["SELECT * FROM tann;"].all

    @annodata = $DB["SELECT * FROM annotationdata WHERE annotation IN (SELECT id FROM tann);"].all

=======
 
    @tr = $DB["SELECT * FROM tann WHERE id IN (SELECT * FROM tann2);"].delete
    @tr = $DB["SELECT * FROM tann WHERE status='deleted';"].delete

    @annotations = $DB["SELECT * FROM tann;"]

    @annodata = $DB["SELECT * FROM WHERE annotation IN (SELECT id FROM tann);"]

#    STDOUT.puts "hi dad " + @annotations.to_s
#      (1..res2.num_rows).each do
#        @annoresult = res2.fetch_hash()
 
#        curranno = AnnoML.new(@annoresult["caption"],@annoresult["type"],@annoresult["domain"],@annoresult["id"])
      
        #query the annotations-dependent subdata database.
#        res3=dbh.query("SELECT * FROM annotationdata WHERE (annotation='#{@annoresult['id']}');")
#        (1..res3.num_rows).each do
#          @annodata = res3.fetch_hash()
#          curranno.dataarray.push([@annodata["id"], @annodata["infokey"], @annodata["value"]])
#        end

#        $annotations.push(curranno)
#      end
>>>>>>> Stashed changes
  end

  $DB.disconnect
  
  if @error
    status 404
  else
    haml :query
  end
end

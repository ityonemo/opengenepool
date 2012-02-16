#seq.rb - provides sequence information when queried.

require 'mysql'

get '/seq/:query' do |query|
  #need to sanitize input

  $annotations = Array.new();

  #connect to the database.
  dbh=Mysql.real_connect("localhost","www-data","", "DNAutics")
    #query the sequences database for the sequence, use the unique ID.

    if (query[0..2].eql?("id="))
      res=dbh.query("SELECT * FROM sequences WHERE (id='"+ query[3..-1] +"');")
    else
      res=dbh.query("SELECT * FROM sequences WHERE (name='#{query}');")
    end

    #save in the "sequence" variable for haml.
    @result = res.fetch_hash()

    #query the sequence-dependent annotations database for the annotations.
    #res2=dbh.query("SELECT * FROM annotations WHERE (sequence='#{query}')")
    #(1..res2.num_rows).each do
    #  row = res2.fetch_hash()
    #  $annotations.push(row)
    #end
  dbh.close if dbh
  
  haml :query
end

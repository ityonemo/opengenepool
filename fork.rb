#fork.rb - runs the appropriate procedures for forking DNA sequences.
#the correct way to specify construct name is to 

require 'mysql'

post '/fork/:query' do |query|
  handleuser()

  if (session[:user])
  
    STDOUT.puts "fork directive recieved for " + query
    STDOUT.puts "source: #{params[:sourceid]}"

    STDOUT.puts "start: #{params[:start]}"
    STDOUT.puts "end: #{params[:end]}"
    STDOUT.puts "orientation: #{params[:orientation]}"

    status 200
  else
    status 403.3
  end
end

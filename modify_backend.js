const fs = require('fs');
const path = require('path');

const servicePath = '/Users/nooons/Documents/Project/badmintoner-api/src/players/players.service.ts';
const controllerPath = '/Users/nooons/Documents/Project/badmintoner-api/src/players/players.controller.ts';

// Modify Service
try {
  let serviceContent = fs.readFileSync(servicePath, 'utf8');
  const serviceInsert = `
  async findAll(): Promise<PlayerDocument[]> {
    return this.playerModel.find().exec();
  }

  async remove(id: string): Promise<PlayerDocument | null> {
    // Delete credentials first
    await this.playerCredentialModel
      .deleteOne({ player_id: new Types.ObjectId(id) })
      .exec();
    // Delete sessions
    await this.playerSessionModel
      .deleteMany({ player_id: new Types.ObjectId(id) })
      .exec();
    // Delete player
    return this.playerModel.findByIdAndDelete(id).exec();
  }

`;
  const serviceTarget = 'async update(id: string, updatePlayerDto: UpdatePlayerDto) {';
  
  if (!serviceContent.includes('async findAll()')) {
    serviceContent = serviceContent.replace(serviceTarget, serviceInsert + serviceTarget);
    fs.writeFileSync(servicePath, serviceContent);
    console.log('Modified players.service.ts');
  } else {
    console.log('players.service.ts already has findAll');
  }
} catch (e) {
  console.error('Error modifying service:', e);
}

// Modify Controller
try {
  let controllerContent = fs.readFileSync(controllerPath, 'utf8');
  
  // Add Delete to imports
  if (!controllerContent.includes('Delete,')) {
    controllerContent = controllerContent.replace('  Get,', '  Get,\n  Delete,');
  }

  const controllerMethods = `
  @Get()
  findAll() {
    return this.playersService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
`;
  
  // Insert before constructor or after class definition
  const classStart = 'export class PlayersController {';
  
  if (!controllerContent.includes('findAll()')) {
    controllerContent = controllerContent.replace(classStart, classStart + '\n' + controllerMethods);
    fs.writeFileSync(controllerPath, controllerContent);
    console.log('Modified players.controller.ts');
  } else {
    console.log('players.controller.ts already has findAll');
  }
} catch (e) {
  console.error('Error modifying controller:', e);
}

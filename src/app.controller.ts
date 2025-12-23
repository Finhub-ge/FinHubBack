import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {

  @Get()
  get() {
    return `Hello, this is the FinHub API! production`;
  }
}
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;
}

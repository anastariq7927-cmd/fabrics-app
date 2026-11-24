import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faScrewdriverWrench,
  faGraduationCap,
  faChalkboardUser,
  faEarthEurope,
  faFlagCheckered,
  faMicrochip,
  faPeopleGroup,
  faCircle,
  faCube,
  faCrosshairs,
  faCompassDrafting,
} from '@fortawesome/free-solid-svg-icons';

// Icons referenced by name from the database (intentions.icon, projects.pillars[].icon, fab_services.icon).
const BY_NAME = {
  'screwdriver-wrench': faScrewdriverWrench,
  'graduation-cap': faGraduationCap,
  'chalkboard-user': faChalkboardUser,
  'earth-europe': faEarthEurope,
  'flag-checkered': faFlagCheckered,
  microchip: faMicrochip,
  'people-group': faPeopleGroup,
  cube: faCube,
  crosshairs: faCrosshairs,
  'compass-drafting': faCompassDrafting,
};

export default function Icon({ name, ...props }) {
  return <FontAwesomeIcon icon={BY_NAME[name] ?? faCircle} {...props} />;
}

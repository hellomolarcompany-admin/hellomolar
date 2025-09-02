import Button from '@/ui/Button';
import Card from '@/ui/Card';
import Divider from '@/ui/Divider';
import Heading from '@/ui/Heading';
import Input from '@/ui/Input';
import Label from '@/ui/Label';
import Select from '@/ui/Select';
import Text from '@/ui/Text';
import Textarea from '@/ui/Textarea';

export default function Page() {
  return (
    <main className="space-y-8 py-6">
      <section>
        <Heading level={1} scriptAccent="Smile Factory">
          Klinika Dental
        </Heading>
        <Text dim className="mt-1">
          Design tokens and primitives preview
        </Text>
      </section>

      <section className="space-y-3">
        <Heading level={3}>Buttons</Heading>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <Divider />

      <section className="space-y-3">
        <Heading level={3}>Form</Heading>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input placeholder="Jane" />
            </div>
            <div>
              <Label>Last name</Label>
              <Input placeholder="Doe" />
            </div>
            <div>
              <Label>Gender</Label>
              <Select>
                <option>Other</option>
                <option>Female</option>
                <option>Male</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} />
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}

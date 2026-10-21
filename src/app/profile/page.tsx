import ProfileForm from "@/components/ProfileForm";

export default function Profile() {
  return (
    <>
      <div className="header">
        <h1>Мой профиль</h1>
        <p>По нему AI подгоняет чужие сценарии под тебя</p>
      </div>
      <ProfileForm />
    </>
  );
}
